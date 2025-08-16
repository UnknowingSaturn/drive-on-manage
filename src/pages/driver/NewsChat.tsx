import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, MessageCircle, Send, Users, Clock, Megaphone, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const NewsChat = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [chatMessage, setChatMessage] = useState('');

  // Get company announcements
  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ['announcements', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .or(`target_audience.eq.all,target_audience.eq.drivers`)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Get driver profile for chat
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id
  });

  // Get real chat messages from the messages table
  const { data: chatMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!profile?.company_id || !user?.id || !profile?.first_name) {
        throw new Error('Missing required data');
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          content,
          sender_id: user.id,
          sender_name: `${profile.first_name} ${profile.last_name || ''}`.trim(),
          sender_role: profile.user_type || 'driver',
          company_id: profile.company_id,
          message_type: 'general'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setChatMessage('');
      toast({
        title: "Message sent",
        description: "Your message has been sent to the team chat.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Bell className="h-4 w-4" />;
      case 'low': return <Megaphone className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    sendMessageMutation.mutate(chatMessage.trim());
  };

  if (announcementsLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading...</p>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center px-4 py-4">
              <SidebarTrigger className="mr-4" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">News & Chat</h1>
                <p className="text-sm text-muted-foreground">Company updates and team communication</p>
              </div>
            </div>
          </header>

          <main className="p-6">
            <Tabs defaultValue="news" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="news" className="flex items-center">
                  <Bell className="h-4 w-4 mr-2" />
                  Company News
                </TabsTrigger>
                <TabsTrigger value="chat" className="flex items-center">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Team Chat
                </TabsTrigger>
              </TabsList>

              <TabsContent value="news" className="space-y-6">
                <Card className="logistics-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Megaphone className="h-5 w-5 text-primary mr-2" />
                      Company Announcements
                    </CardTitle>
                    <CardDescription>
                      Latest news and updates from management
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {announcements && announcements.length === 0 ? (
                      <div className="text-center py-8">
                        <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No announcements at the moment</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {announcements?.map((announcement) => (
                          <div key={announcement.id} className="p-4 border rounded-lg bg-card/50 hover-lift">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <Badge variant={getPriorityColor(announcement.priority)} className="flex items-center">
                                  {getPriorityIcon(announcement.priority)}
                                  <span className="ml-1 capitalize">{announcement.priority}</span>
                                </Badge>
                                <Badge variant="outline">
                                  {announcement.target_audience === 'all' ? 'All Staff' : 'Drivers'}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(announcement.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            
                            <h3 className="font-semibold text-lg mb-2">{announcement.title}</h3>
                            <p className="text-muted-foreground mb-3">
                              {announcement.content}
                            </p>
                            
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {new Date(announcement.created_at).toLocaleString()}
                              </div>
                              <div>
                                By: Management
                              </div>
                            </div>
                            
                            {announcement.expires_at && new Date(announcement.expires_at) > new Date() && (
                              <div className="mt-2 text-sm text-warning">
                                Expires: {new Date(announcement.expires_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="chat" className="space-y-6">
                <Card className="logistics-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="h-5 w-5 text-primary mr-2" />
                      Team Chat
                    </CardTitle>
                    <CardDescription>
                      Real-time communication with your team
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px] p-4">
                      {messagesLoading ? (
                        <div className="flex items-center justify-center h-32">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      ) : chatMessages && chatMessages.length > 0 ? (
                        <div className="space-y-4">
                          {chatMessages.reverse().map((message) => {
                            const initials = message.sender_name
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .toUpperCase();
                            
                            return (
                              <div key={message.id} className="flex items-start space-x-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className={`text-xs ${
                                    message.sender_role === 'admin' 
                                      ? 'bg-primary text-primary-foreground' 
                                      : 'bg-secondary text-secondary-foreground'
                                  }`}>
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium">{message.sender_name}</span>
                                    <Badge variant={message.sender_role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                                      {message.sender_role}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(message.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-foreground">{message.content}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-32 text-center">
                          <div>
                            <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                    
                    <div className="border-t p-4">
                      <div className="flex space-x-2">
                        <Input
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          placeholder="Type a message..."
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <Button
                          onClick={handleSendMessage}
                          className="logistics-button"
                          disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                        >
                          {sendMessageMutation.isPending ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Chat Guidelines */}
                <Card className="logistics-card">
                  <CardHeader>
                    <CardTitle className="flex items-center text-muted-foreground">
                      <MessageCircle className="h-5 w-5 mr-2" />
                      Chat Guidelines
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        <h4 className="font-medium mb-2">✓ Do:</h4>
                        <ul className="space-y-1">
                          <li>• Share route updates and traffic info</li>
                          <li>• Ask for help or guidance</li>
                          <li>• Report urgent delivery issues</li>
                          <li>• Keep conversations professional</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">✗ Don't:</h4>
                        <ul className="space-y-1">
                          <li>• Share personal information</li>
                          <li>• Use inappropriate language</li>
                          <li>• Spam or flood the chat</li>
                          <li>• Discuss sensitive company matters</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default NewsChat;