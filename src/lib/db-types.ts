// Auto-generated from your database schema — do not edit by hand.
// Regenerates automatically whenever a table is created or altered.

export type AffiliateEventsRow = {
  id: string
  affiliateCode: string
  eventType: string
  targetUrl: string | null
  label: string | null
  conversionType: string | null
  timestamp: string | null
  userId: string | null
}

export type UsersRow = {
  id: string
  email: string
  emailVerified: number | string | null
  displayName: string | null
  avatarUrl: string | null
  phone: string | null
  phoneVerified: number | string | null
  role: string | null
  metadata: string | null
  createdAt: string
  updatedAt: string
  lastSignIn: string
}
