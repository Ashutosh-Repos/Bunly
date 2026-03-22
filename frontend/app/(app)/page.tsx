import { redirect } from "next/navigation";

/**
 * Home page — redirects authenticated users to /me.
 *
 * The (app) layout already enforces auth + onboarding,
 * so any user reaching here is fully authenticated.
 */
export default function HomePage() {
    redirect("/me");
}
