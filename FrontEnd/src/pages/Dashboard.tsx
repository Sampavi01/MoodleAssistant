import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { AssignmentCard, Assignment } from '@/components/AssignmentCard';
import { ExplanationModal } from '@/components/ExplanationModal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { fetchAssignments } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  GraduationCap, 
  Calendar as CalendarIcon, 
  BookOpen, 
  LogOut,
  RefreshCw,
  User
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedAssignmentTitle, setSelectedAssignmentTitle] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAssignments();
      setAssignments(data);
    } catch (error: any) {
      // Mock data for demo purposes
      const mockAssignments: Assignment[] = [
        {
          id: '1',
          title: 'React Component Architecture Essay',
          course: 'Advanced Web Development',
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'Write a comprehensive essay about React component architecture and best practices.',
          priority: 'high' as const,
          status: 'pending' as const,
        },
        {
          id: '2',
          title: 'Database Design Project',
          course: 'Database Systems',
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'Design and implement a database schema for an e-commerce application.',
          priority: 'medium' as const,
          status: 'in-progress' as const,
        },
        {
          id: '3',
          title: 'Machine Learning Algorithm Analysis',
          course: 'Artificial Intelligence',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'Analyze and compare different machine learning algorithms for classification tasks.',
          priority: 'low' as const,
          status: 'pending' as const,
        },
        {
          id: '4',
          title: 'Software Testing Report',
          course: 'Software Engineering',
          dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'Create a comprehensive testing report for the semester project.',
          priority: 'high' as const,
          status: 'pending' as const,
        },
      ];
      setAssignments(mockAssignments);
      
      toast({
        title: "Demo Mode",
        description: "Showing sample assignments. Connect to your backend for real data.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplain = (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    setSelectedAssignmentId(assignmentId);
    setSelectedAssignmentTitle(assignment?.title || '');
    setModalOpen(true);
  };

  const getAssignmentDates = () => {
    return assignments.map(assignment => new Date(assignment.dueDate));
  };

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null;
    
    const assignmentDates = getAssignmentDates();
    const hasAssignment = assignmentDates.some(
      assignmentDate => 
        assignmentDate.toDateString() === date.toDateString()
    );
    
    return hasAssignment ? 'assignment-due' : null;
  };

  const pendingAssignments = assignments.filter(a => a.status !== 'completed');
  const overdueAssignments = assignments.filter(a => 
    new Date(a.dueDate) < new Date() && a.status !== 'completed'
  );

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b shadow-soft sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Education Assistant</h1>
                <p className="text-sm text-muted-foreground">Welcome back, {user?.name || user?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={loadAssignments} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <LoadingSpinner size="lg" className="text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading your assignments...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Stats & Calendar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="shadow-card">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary mb-1">
                      {pendingAssignments.length}
                    </div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </CardContent>
                </Card>
                <Card className="shadow-card">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-destructive mb-1">
                      {overdueAssignments.length}
                    </div>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                  </CardContent>
                </Card>
              </div>

              {/* Calendar */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    Assignment Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    onChange={(value) => setSelectedDate(value as Date)}
                    value={selectedDate}
                    tileClassName={tileClassName}
                    className="w-full border-none"
                  />
                  <div className="mt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-destructive/20 border border-destructive/30 rounded"></div>
                      <span>Days with assignments due</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Columns - Assignment List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" />
                  Your Assignments
                </h2>
                <div className="text-sm text-muted-foreground">
                  {assignments.length} total assignments
                </div>
              </div>

              {assignments.length === 0 ? (
                <Card className="shadow-card">
                  <CardContent className="py-12 text-center">
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No assignments found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {assignments.map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      onExplain={handleExplain}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ExplanationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        assignmentId={selectedAssignmentId}
        assignmentTitle={selectedAssignmentTitle}
      />
    </div>
  );
};

export default Dashboard;