import io
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import requests
import jwt
from datetime import datetime, timedelta
from pymongo import MongoClient
from openai import OpenAI
from langchain_openai import ChatOpenAI
from langchain.agents import create_react_agent, AgentExecutor
from langchain.prompts import PromptTemplate
from langchain.tools import Tool
from PyPDF2 import PdfReader
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# Secrets (use env vars)
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
MOODLE_URL = "https://online.uom.lk/webservice/rest/server.php"
MOODLE_SERVICE = os.getenv("MOODLE_SERVICE", "moodle_mobile_app")

# Validate environment variables
if not all([SECRET_KEY, OPENAI_API_KEY, MONGO_URI]):
    raise Exception("Missing required environment variables: JWT_SECRET_KEY, OPENAI_API_KEY, MONGO_URI")

# MongoDB connection with error handling
try:
    client = MongoClient(MONGO_URI)
    db = client["education_db"]
    users_collection = db["users"]
except Exception as e:
    raise Exception(f"MongoDB connection failed: {str(e)}")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class Login(BaseModel):
    username: str
    password: str

# JWT functions
def create_jwt_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.post("/login")
async def login(user: Login):
    try:
        response = requests.post(
            f"https://online.uom.lk/login/token.php",
            data={
                "username": user.username,
                "password": user.password,
                "service": MOODLE_SERVICE
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        if "token" not in data:
            raise HTTPException(status_code=401, detail="Invalid Moodle credentials: " + data.get("error", "Unknown error"))
        
        moodle_token = data["token"]
        
        # Store in MongoDB
        user_data = {"username": user.username, "moodle_token": moodle_token}
        users_collection.update_one({"username": user.username}, {"$set": user_data}, upsert=True)
        
        # Issue JWT
        access_token = create_jwt_token({"sub": user.username})
        return {"access_token": access_token, "token_type": "bearer"}
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Moodle API request failed: {str(e)}")

@app.get("/assignments")
async def get_assignments(current_user: str = Depends(get_current_user)):
    user = users_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    moodle_token = user["moodle_token"]
    
    try:
        # Fetch calendar events
        params = {
            "wstoken": moodle_token,
            "wsfunction": "core_calendar_get_calendar_events",
            "moodlewsrestformat": "json",
            "events[eventtype]": "user"
        }
        response = requests.get(MOODLE_URL, params=params, timeout=10)
        response.raise_for_status()
        events = response.json().get("events", [])
        
        # Filter pending assignments
        pending = [
            e for e in events
            if e["eventtype"] == "due" and datetime.fromtimestamp(e["timestart"]) > datetime.utcnow()
        ]
        
        assignments = []
        for event in pending:
            assign_params = {
                "wstoken": moodle_token,
                "wsfunction": "mod_assign_get_assignments",
                "moodlewsrestformat": "json",
                "courseids[0]": event["courseid"]
            }
            assign_resp = requests.get(MOODLE_URL, params=assign_params, timeout=10)
            assign_resp.raise_for_status()
            courses = assign_resp.json().get("courses", [])
            if not courses:
                continue
            assigns = courses[0].get("assignments", [])
            matching_assign = next(
                (a for a in assigns if a["id"] == event["instance"] or a.get("cmid") == event.get("moduleid")),
                None
            )
            if matching_assign:
                pdf_url = None
                if matching_assign.get("introattachments"):
                    for attachment in matching_assign["introattachments"]:
                        if attachment["filename"].lower().endswith(".pdf"):
                            pdf_url = f"{attachment['fileurl']}?token={moodle_token}"
                            break
                assignments.append({
                    "name": matching_assign["name"],
                    "due_date": datetime.fromtimestamp(matching_assign["duedate"]).isoformat(),
                    "pdf_url": pdf_url,
                    "course_id": event["courseid"],
                    "assignment_id": matching_assign["id"]
                })
        
        # Cache in MongoDB
        users_collection.update_one(
            {"username": current_user},
            {"$set": {"assignments": assignments}},
            upsert=True
        )
        
        return assignments
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Moodle API request failed: {str(e)}")

def download_pdf(url: str) -> bytes:
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.content
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to download PDF: {str(e)}")

def extract_pdf_text(pdf_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = " ".join(page.extract_text() or "" for page in reader.pages)
        if not text.strip():
            raise ValueError("No text extracted from PDF")
        return text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")

extract_tool = Tool(name="extract_pdf", func=extract_pdf_text, description="Extract text from PDF bytes")

# Multi-Agent Setup
llm = ChatOpenAI(model="gpt-4o-mini", openai_api_key=OPENAI_API_KEY)

# Refined prompts
extract_prompt = PromptTemplate.from_template(
    "Extract the main tasks, requirements, and key instructions from this assignment text: {text}. Focus on actionable items and ignore boilerplate."
)
simplify_prompt = PromptTemplate.from_template(
    "Explain this assignment in simple, clear language for a student, using bullet points: {extracted}"
)
review_prompt = PromptTemplate.from_template(
    "Review this explanation for accuracy and clarity. Improve it if needed, keeping it concise and student-friendly: {simplified}"
)

# Agents
extract_agent = create_react_agent(llm, [extract_tool], extract_prompt)
extract_executor = AgentExecutor(agent=extract_agent, tools=[extract_tool])
simplify_agent = create_react_agent(llm, [], simplify_prompt)
simplify_executor = AgentExecutor(agent=simplify_agent, tools=[])
review_agent = create_react_agent(llm, [], review_prompt)
review_executor = AgentExecutor(agent=review_agent, tools=[])

@app.get("/explain/{assignment_id}")
async def explain_assignment(assignment_id: str, current_user: str = Depends(get_current_user)):
    user = users_collection.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    assignment = next(
        (a for a in user.get("assignments", []) if str(a["assignment_id"]) == assignment_id),
        None
    )
    if not assignment or not assignment["pdf_url"]:
        raise HTTPException(status_code=404, detail="Assignment or PDF not found")
    
    # Check for cached explanation
    if "explanation" in assignment:
        return {"explanation": assignment["explanation"]}
    
    pdf_bytes = download_pdf(assignment["pdf_url"])
    extracted = extract_executor.invoke({"text": extract_pdf_text(pdf_bytes)})["output"]
    simplified = simplify_executor.invoke({"extracted": extracted})["output"]
    final_explanation = review_executor.invoke({"simplified": simplified})["output"]
    
    # Cache explanation
    users_collection.update_one(
        {"username": current_user, "assignments.assignment_id": assignment_id},
        {"$set": {"assignments.$.explanation": final_explanation}}
    )
    
    return {"explanation": final_explanation}