import "dotenv/config";
import { Resend } from "resend";

async function main() {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Content Creator Hub <noreply@aimakergigs.com>",
    to: ["delivered@resend.dev"],
    subject: "Verify test from aimakergigs.com",
    html: "<h1>It works from your domain!</h1>",
  });

  if (error) {
    console.error("ERROR:", JSON.stringify(error, null, 2));
    process.exit(1);
  } else {
    console.log("SUCCESS:", data?.id);
  }
}

main();
