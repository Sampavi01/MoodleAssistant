import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, BookOpen, Calendar, AlertCircle } from 'lucide-react';

export interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
}

interface AssignmentCardProps {
  assignment: Assignment;
  onExplain: (assignmentId: string) => void;
}

export const AssignmentCard: React.FC<AssignmentCardProps> = ({ assignment, onExplain }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-primary text-primary-foreground';
      case 'low': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-accent text-accent-foreground';
      case 'in-progress': return 'bg-primary text-primary-foreground';
      case 'pending': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const isOverdue = new Date(assignment.dueDate) < new Date();
  const daysToDue = Math.ceil((new Date(assignment.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

  return (
    <Card className="shadow-card hover:shadow-glow transition-all duration-300 hover:scale-105 transform animate-slide-up">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight flex items-start gap-2">
            <BookOpen className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{assignment.title}</span>
          </CardTitle>
          {isOverdue && (
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          )}
        </div>
        <p className="text-sm text-muted-foreground font-medium">{assignment.course}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {assignment.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {assignment.description}
          </p>
        )}
        
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className={isOverdue ? 'text-destructive font-medium' : 'text-foreground'}>
            Due: {new Date(assignment.dueDate).toLocaleDateString()}
          </span>
          {!isOverdue && daysToDue <= 3 && (
            <Badge variant="outline" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {daysToDue === 0 ? 'Today' : `${daysToDue} days`}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Badge className={getPriorityColor(assignment.priority)}>
              {assignment.priority}
            </Badge>
            <Badge variant="outline" className={getStatusColor(assignment.status)}>
              {assignment.status.replace('-', ' ')}
            </Badge>
          </div>
          
          <Button
            variant="education"
            size="sm"
            onClick={() => onExplain(assignment.id)}
            className="ml-auto"
          >
            <BookOpen className="w-4 h-4 mr-1" />
            Explain
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};