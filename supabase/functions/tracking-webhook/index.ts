import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FB_ACCESS_TOKEN = Deno.env.get("FB_ACCESS_TOKEN")
const FB_PIXEL_ID = Deno.env.get("FB_PIXEL_ID")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

serve(async (req) => {
  try {
    const payload = await req.json()
    console.log("Webhook received:", payload)

    // Determine event type (adjust based on your gateway's payload)
    // For example, if it's a 'payment.approved' event
    const isApproved = payload.status === 'approved' || payload.event === 'payment.approved'
    
    if (!isApproved) {
      return new Response(JSON.stringify({ message: "Event ignored" }), { status: 200 })
    }

    const email = payload.customer?.email || payload.email
    const phone = payload.customer?.phone || payload.phone
    const value = payload.amount || payload.value
    const currency = payload.currency || "BRL"
    const eventId = payload.transaction_id || payload.id || `purchase_${Date.now()}`
    
    // Hash helper
    const hash = async (text: string) => {
      if (!text) return null
      const encoder = new TextEncoder()
      const data = encoder.encode(text.trim().toLowerCase())
      const hashBuffer = await crypto.subtle.digest("SHA-256", data)
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    }

    const hashedEmail = await hash(email)
    const hashedPhone = await hash(phone)

    // Get UTMs from database if needed (optional, depends on if gateway sends them back)
    let utms: any = {}
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && email) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (lead) {
        utms = {
          utm_source: lead.utm_source,
          utm_medium: lead.utm_medium,
          utm_campaign: lead.utm_campaign,
          utm_content: lead.utm_content,
          utm_term: lead.utm_term,
          fbp: lead.fbp,
          fbc: lead.fbc,
        }
      }
    }

    // Send to Meta Conversions API
    if (FB_ACCESS_TOKEN && FB_PIXEL_ID) {
      const fbData = {
        data: [
          {
            event_name: "Purchase",
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            action_source: "website",
            user_data: {
              em: hashedEmail ? [hashedEmail] : [],
              ph: hashedPhone ? [hashedPhone] : [],
              fbp: utms.fbp || payload.fbp,
              fbc: utms.fbc || payload.fbc,
              client_ip_address: req.headers.get("x-forwarded-for") || payload.ip,
              client_user_agent: req.headers.get("user-agent") || payload.user_agent,
            },
            custom_data: {
              value: value,
              currency: currency,
              content_name: payload.product_name,
              content_type: "product",
              ...utms
            },
          },
        ],
      }

      await fetch(`https://graph.facebook.com/v17.0/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fbData),
      })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err) {
    console.error("Webhook error:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
