import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  fetchOptions: {
    credentials: "include",
  },
  user: {
    additionalFields: {
      dob: { type: "date", required: false, returned: true },
    },
  },
  plugins: [adminClient()],
});
