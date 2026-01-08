import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Lock, AlertCircle } from 'lucide-react';
import { PublicProjectData } from '../../hooks/use-public-project';

interface CustomerLoginFormProps {
  project: Pick<PublicProjectData, 'name' | 'slug' | 'hasPassword'>;
  onLogin: (password: string) => Promise<void>;
}

export function CustomerLoginForm({ project, onLogin }: CustomerLoginFormProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await onLogin(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-2">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-muted rounded-full">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-bold">{project.name}</CardTitle>
          <CardDescription className="text-center">
            This project is password protected. Enter the access code to view the board.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Project Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading || !password.trim()}>
              {isLoading ? 'Verifying...' : 'Access Board'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center text-xs text-muted">
          Protected by AutoMaker Secure Access
        </CardFooter>
      </Card>
    </div>
  );
}
