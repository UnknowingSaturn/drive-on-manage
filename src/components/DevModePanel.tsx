import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Code, Terminal, TestTube, Settings } from 'lucide-react';
import TestRunner from './TestRunner';

const DevModePanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development mode
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <>
      {/* Dev Mode Toggle Button */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(!isVisible)}
          variant="outline"
          className="gap-2 bg-background/80 backdrop-blur-sm"
        >
          <Code className="h-4 w-4" />
          Dev Mode
          <Badge variant="secondary" className="ml-1">
            DEV
          </Badge>
        </Button>
      </div>

      {/* Dev Mode Panel */}
      {isVisible && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm">
          <div className="fixed top-16 right-4 bottom-4 w-1/2 bg-background border rounded-lg shadow-lg">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Development Tools
                </CardTitle>
                <Button
                  onClick={() => setIsVisible(false)}
                  variant="ghost"
                  size="sm"
                >
                  ×
                </Button>
              </CardHeader>
              <CardContent className="h-full overflow-hidden">
                <Tabs defaultValue="tests" className="h-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="tests" className="gap-2">
                      <TestTube className="h-4 w-4" />
                      Tests
                    </TabsTrigger>
                    <TabsTrigger value="console" className="gap-2">
                      <Terminal className="h-4 w-4" />
                      Console
                    </TabsTrigger>
                    <TabsTrigger value="info" className="gap-2">
                      <Code className="h-4 w-4" />
                      Info
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="tests" className="h-full mt-4">
                    <TestRunner />
                  </TabsContent>
                  
                  <TabsContent value="console" className="h-full mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Console Output</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">
                          Check browser DevTools console for detailed logs
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="info" className="h-full mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Development Info</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Environment</h4>
                          <Badge variant="outline">Development</Badge>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Available Commands</h4>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>• Use Test Runner tab for automated testing</li>
                            <li>• Check Console tab for runtime logs</li>
                            <li>• Press F12 for browser DevTools</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
};

export default DevModePanel;