import { ReactNode } from "react";
import { getTrpcServer } from "@/lib/trpc-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { IconShieldCheck, IconFlag, IconLogout } from "@tabler/icons-react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
    const trpcServer = await getTrpcServer();
    
    // Auth check - should throw/redirect if not admin
    let isAdmin = false;
    try {
        const stats = await trpcServer.admin.getStats.query();
        if (stats) isAdmin = true;
    } catch {
        // Not authorized or error
    }

    if (!isAdmin) {
        redirect("/");
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border/20 bg-muted/10 h-full flex flex-col">
                <div className="p-6 border-b border-border/20 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary">
                        <IconShieldCheck size={20} />
                    </div>
                    <span className="font-black tracking-widest uppercase text-sm">Bunly Admin</span>
                </div>
                
                <nav className="flex-1 p-4 flex flex-col gap-2">
                    <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                        <IconFlag size={18} />
                        Reports
                    </Link>
                    {/* Extendable for users/videos later */}
                </nav>

                <div className="p-4 border-t border-border/20">
                    <Link href="/" className="flex items-center gap-3 px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors">
                        <IconLogout size={18} />
                        Exit Admin
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-background">
                {children}
            </main>
        </div>
    );
}
