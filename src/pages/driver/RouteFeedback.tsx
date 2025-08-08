import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, MapPin, Car, Building, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const RouteFeedback = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [ratings, setRatings] = useState({
    routeDifficulty: 0,
    trafficRating: 0,
    depotExperience: 0
  });
  const [notes, setNotes] = useState('');

  // Fetch driver profile to get their ID
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

  // Fetch recent feedback
  const { data: recentFeedback } = useQuery({
    queryKey: ['route-feedback', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id) return [];
      
      const { data, error } = await supabase
        .from('route_feedback')
        .select(`
          *,
          rounds(round_number, description)
        `)
        .eq('driver_id', driverProfile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!driverProfile?.id
  });

  // Submit feedback mutation
  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: any) => {
      const { error } = await supabase
        .from('route_feedback')
        .insert({
          driver_id: driverProfile?.id,
          company_id: driverProfile?.company_id,
          route_difficulty: feedbackData.routeDifficulty,
          traffic_rating: feedbackData.trafficRating,
          depot_experience: feedbackData.depotExperience,
          notes: feedbackData.notes || null
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Feedback submitted",
        description: "Thank you for your route feedback!",
      });
      setRatings({ routeDifficulty: 0, trafficRating: 0, depotExperience: 0 });
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['route-feedback'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error submitting feedback",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const StarRating = ({ 
    value, 
    onChange, 
    label 
  }: { 
    value: number; 
    onChange: (rating: number) => void; 
    label: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="transition-colors"
          >
            <Star
              className={`h-6 w-6 ${
                star <= value
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground hover:text-yellow-400'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ratings.routeDifficulty || !ratings.trafficRating || !ratings.depotExperience) {
      toast({
        title: "Please provide all ratings",
        description: "All rating fields are required",
        variant: "destructive",
      });
      return;
    }

    submitFeedbackMutation.mutate({
      ...ratings,
      notes
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Route Feedback</h1>
        <p className="text-muted-foreground">Help us improve routes by sharing your experience</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submit Today's Route Feedback</CardTitle>
          <CardDescription>
            Rate your experience to help improve future route planning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4" />
                  Route Difficulty
                </div>
                <StarRating
                  value={ratings.routeDifficulty}
                  onChange={(rating) => setRatings(prev => ({ ...prev, routeDifficulty: rating }))}
                  label="How challenging was the route?"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Car className="h-4 w-4" />
                  Traffic Conditions
                </div>
                <StarRating
                  value={ratings.trafficRating}
                  onChange={(rating) => setRatings(prev => ({ ...prev, trafficRating: rating }))}
                  label="How was the traffic today?"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building className="h-4 w-4" />
                  Depot Experience
                </div>
                <StarRating
                  value={ratings.depotExperience}
                  onChange={(rating) => setRatings(prev => ({ ...prev, depotExperience: rating }))}
                  label="How was the depot experience?"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific issues, road closures, or suggestions..."
                rows={3}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={submitFeedbackMutation.isPending}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Feedback History</CardTitle>
          <CardDescription>Your previous route feedback submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {recentFeedback?.length ? (
            <div className="space-y-4">
              {recentFeedback.map((feedback: any) => (
                <div key={feedback.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm text-muted-foreground">
                      {new Date(feedback.feedback_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Route:</span>
                      <div className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < feedback.route_difficulty
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Traffic:</span>
                      <div className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < feedback.traffic_rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Depot:</span>
                      <div className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < feedback.depot_experience
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  {feedback.notes && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium">Notes:</span> {feedback.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No feedback submitted yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RouteFeedback;