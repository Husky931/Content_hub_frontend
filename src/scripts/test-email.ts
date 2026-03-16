import "dotenv/config";
import { Resend } from "resend";

async function main() {
  const resend = new Resend(process.env.RESEND_API_KEY);
  console.log("API key present:", !!process.env.RESEND_API_KEY);
  console.log("API key prefix:", process.env.RESEND_API_KEY?.slice(0, 10));

  const testTo = process.argv[2] || "delivered@resend.dev";
  console.log("Sending to:", testTo);

  const { data, error } = await resend.emails.send({
    from: "Content Creator Hub <onboarding@resend.dev>",
    to: [testTo],
    subject: "Content Creator Hub — Email Test",
    html: "<h1>It works!</h1><p>Your Resend integration is working correctly.</p>",
  });

  if (error) {
    console.error("ERROR:", JSON.stringify(error, null, 2));
    process.exit(1);
  } else {
    console.log("SUCCESS — email id:", data?.id);
  }
}

main();
