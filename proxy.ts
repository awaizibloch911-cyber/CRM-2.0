import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Public routes that don't require authentication
const publicRoutes = ["/login", "/register"]

// API routes that don't require authentication
const publicApiRoutes = ["/api/auth/login", "/api/auth/register"]

export function proxy(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
