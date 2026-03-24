import Dysmsapi20170525, * as $Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";

const SMS_SIGN_NAME = "北京自成长教育科技";
const SMS_TEMPLATE_CODE = "SMS_504055089";

let _client: Dysmsapi20170525 | null = null;

function getClient(): Dysmsapi20170525 {
  if (_client) return _client;

  const accessKeyId = process.env.SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.SMS_ACCESS_KEY_SECRET;

  if (!accessKeyId || !accessKeySecret) {
    throw new Error(
      "Missing SMS credentials: SMS_ACCESS_KEY_ID and SMS_ACCESS_KEY_SECRET must be set"
    );
  }

  const config = new $OpenApi.Config({
    accessKeyId,
    accessKeySecret,
  });
  config.endpoint = "dysmsapi.aliyuncs.com";
  _client = new Dysmsapi20170525(config);
  return _client;
}

/**
 * Send an SMS verification code to a Chinese phone number.
 * Returns { success, message } — never throws.
 */
export async function sendSmsCode(
  phoneNumber: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  try {
    const client = getClient();
    const request = new $Dysmsapi20170525.SendSmsRequest({
      signName: SMS_SIGN_NAME,
      templateCode: SMS_TEMPLATE_CODE,
      phoneNumbers: phoneNumber,
      templateParam: JSON.stringify({ code }),
    });
    const runtime = new $Util.RuntimeOptions({});
    const resp = await client.sendSmsWithOptions(request, runtime);

    if (resp.body?.code === "OK") {
      console.log(`[sms] sent code to ${phoneNumber}, bizId=${resp.body.bizId}`);
      return { success: true, message: "SMS sent" };
    }

    console.error("[sms] Aliyun returned non-OK:", resp.body?.code, resp.body?.message);
    return { success: false, message: resp.body?.message || "SMS send failed" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[sms] send error:", msg);
    return { success: false, message: msg };
  }
}
