import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api'; // Adjust based on your backend

// Configure axios defaults
axios.defaults.baseURL = API_BASE_URL;

// Auth token management
export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('authToken', token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('authToken');
  delete axios.defaults.headers.common['Authorization'];
};

// Initialize axios with token if it exists
const token = getAuthToken();
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Auth API functions
export const login = async (username: string, password: string): Promise<{ token: string; user: any }> => {
  try {
    const response = await axios.post('/login', { username, password });
    const { token, user } = response.data;
    setAuthToken(token);
    return { token, user };
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || 'Login failed');
  }
};

export const logout = (): void => {
  removeAuthToken();
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

// API functions for assignments
export const fetchAssignments = async () => {
  try {
    const response = await axios.get('/assignments');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch assignments');
  }
};

export const explainAssignment = async (assignmentId: string): Promise<{ explanation: string }> => {
  try {
    const response = await axios.post(`/explain`, { assignmentId });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || 'Failed to get explanation');
  }
};