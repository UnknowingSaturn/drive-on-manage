import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Eye, MessageSquare, TrendingUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const FeedbackWidget = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quickRating, setQuickRating] = useState(0);

  // Fetch driver profile
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', profile.user_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.user_id
  });

  // Fetch recent feedback summary
  const { data: feedbackSummary } = useQuery({
    queryKey: ['feedback-summary', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id) return null;
      
      const { data, error } = await supabase
        .from('route_feedback')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      if (data.length === 0) return { averageRating: 0, totalFeedback: 0 };
      
      const avgRoute = data.reduce((sum, f) => sum + f.route_difficulty, 0) / data.length;
      const avgTraffic = data.reduce((sum, f) => sum + f.traffic_rating, 0) / data.length;
      const avgDepot = data.reduce((sum, f) => sum + f.depot_experience, 0) / data.length;
      
      return {
        averageRating: ((avgRoute + avgTraffic + avgDepot) / 3),
        totalFeedback: data.length
      };
    },
    enabled: !!driverProfile?.id
  });

  // Quick feedback submission
  const submitQuickFeedback = useMutation({
    mutationFn: async () => {
      if (!driverProfile?.id || quickRating === 0) return;
      
      const { error } = await supabase
        .from('route_feedback')
        .insert({
          driver_id: driverProfile.id,
          company_id: driverProfile.company_id,
          route_difficulty: quickRating,
          traffic_rating: quickRating,
          depot_experience: quickRating,
          notes: 'Quick rating from dashboard'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Feedback submitted",
        description: "Thank you for your quick rating!",
      });
      setQuickRating(0);
      queryClient.invalidateQueries({ queryKey: ['feedback-summary'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    }
  });

  const StarRating = ({ rating, onRatingChange }: { rating: number; onRatingChange: (rating: number) => void }) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 cursor-pointer transition-colors ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
            }`}
            onClick={() => onRatingChange(star)}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className="logistics-card bg-gradient-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Route Feedback</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/driver/feedback')}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Quick rating & feedback</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {feedbackSummary && feedbackSummary.totalFeedback > 0 && (
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gradient">
                {feedbackSummary.averageRating.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">Avg Rating</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-primary">
                {feedbackSummary.totalFeedback}
              </div>
              <div className="text-xs text-muted-foreground">Total Feedback</div>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          <div className="text-sm font-medium">Quick Route Rating</div>
          <div className="flex items-center space-x-2">
            <StarRating rating={quickRating} onRatingChange={setQuickRating} />
            <Button 
              size="sm" 
              variant="outline"
              disabled={quickRating === 0 || submitQuickFeedback.isPending}
              onClick={() => submitQuickFeedback.mutate()}
            >
              Submit
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Rate today's route difficulty
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeedbackWidget;