import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql`DELETE FROM upload_submissions`;
  console.log("✓ upload_submissions cleared");

  await sql`DELETE FROM user_progress`;
  console.log("✓ user_progress cleared");

  await sql`DELETE FROM test_questions`;
  console.log("✓ test_questions cleared");

  await sql`DELETE FROM tests`;
  console.log("✓ tests cleared");

  await sql`DELETE FROM trainer_prompts`;
  console.log("✓ trainer_prompts cleared");

  await sql`DELETE FROM lessons`;
  console.log("✓ lessons cleared");

  await sql`DELETE FROM user_tags`;
  console.log("✓ user_tags cleared");

  await sql`DELETE FROM tags`;
  console.log("✓ tags cleared");

  console.log("\nAll training data reset. You can start fresh.");
}

main().catch(console.error);
