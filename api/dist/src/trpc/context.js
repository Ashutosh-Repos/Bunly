var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { auth } from "../lib/auth.js";
/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/v11/context
 */
export function createContext(_a) {
    return __awaiter(this, arguments, void 0, function* ({ req, res }) {
        const headers = new Headers();
        Object.entries(req.headers).forEach(([key, value]) => {
            if (value) {
                if (Array.isArray(value)) {
                    value.forEach((v) => headers.append(key, v));
                }
                else {
                    headers.set(key, value);
                }
            }
        });
        // Pass Fastify's raw IP to Better-Auth rate limiting
        // Note: Fastify's req.ip is already processed by its 'trustProxy' setting
        if (req.ip) {
            headers.set("X-Forwarded-For", req.ip);
        }
        const session = yield auth.api.getSession({
            headers: headers,
        });
        return {
            req,
            res,
            headers,
            session,
        };
    });
}
