import { useQuery } from "@tanstack/react-query";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, ShieldAlert, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";

interface User {
    id: string;
    username: string;
    email: string | null;
    isAdmin: boolean;
    currentPlan: string;
    createdAt: string;
}

export default function AdminDashboard() {
    const { user: currentUser, isLoading: authLoading } = useAuth();

    const { data: users, isLoading: usersLoading } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
        enabled: !!currentUser?.isAdmin,
    });

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!currentUser?.isAdmin) {
        return <Redirect to="/" />;
    }

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                <Badge variant="outline" className="text-lg py-1 px-4">
                    Total Users: {users?.length || 0}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Registered Users</CardTitle>
                </CardHeader>
                <CardContent>
                    {usersLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users?.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-primary/10 p-2 rounded-full">
                                                    <UserIcon className="h-4 w-4 text-primary" />
                                                </div>
                                                {user.username}
                                            </div>
                                        </TableCell>
                                        <TableCell>{user.email || "No email"}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.currentPlan === "full" ? "default" : "secondary"}>
                                                {user.currentPlan.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {user.isAdmin ? (
                                                <Badge variant="destructive" className="gap-1">
                                                    <ShieldAlert className="h-3 w-3" /> Admin
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="gap-1">
                                                    <Shield className="h-3 w-3" /> User
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                Online
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
