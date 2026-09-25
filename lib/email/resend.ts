import type { ReminderSender, ReminderToSend } from "../reminder-processing";

const resendEndpoint = "https://api.resend.com/emails";

type ResendResponse = {
	id?: string;
};

function requiredEnv(name: string): string {
	const value = process.env[name]?.trim();

	if (!value) {
		throw new Error(`${name} is not configured.`);
	}

	return value;
}

function emailList(name: string): string[] {
	return requiredEnv(name)
		.split(",")
		.map((email) => email.trim())
		.filter(Boolean);
}

async function sendEmail(input: {
	to: string[];
	cc?: string[];
	subject: string;
	text: string;
}): Promise<ResendResponse> {
	const response = await fetch(resendEndpoint, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: requiredEnv("EMAIL_FROM"),
			to: input.to,
			...(input.cc?.length ? { cc: input.cc } : {}),
			subject: input.subject,
			text: input.text,
		}),
	});

	if (!response.ok) {
		const detail = await response.text();
		throw new Error(`Resend API ${response.status}: ${detail}`);
	}

	return (await response.json()) as ResendResponse;
}

function reminderContent(reminder: ReminderToSend) {
	if (reminder.type === "ADMIN") {
		return {
			subject: `Flight reminder due for ${reminder.travellerName}`,
			text: [
				`A flight reminder is due for ${reminder.travellerName}.`,
				`Traveller email: ${reminder.travellerEmail}`,
				`Reminder ID: ${reminder.reminderId}`,
			].join("\n"),
		};
	}

	return {
		subject: "Your flight reminder",
		text: [
			`Hello ${reminder.travellerName},`,
			"This is your scheduled flight reminder.",
			`Reminder ID: ${reminder.reminderId}`,
		].join("\n"),
	};
}

export function createResendReminderSender(): ReminderSender {
	return async (reminder) => {
		const admins = emailList("ADMIN_EMAILS");
		const content = reminderContent(reminder);
		const result = await sendEmail({
			to: reminder.type === "ADMIN" ? admins : [reminder.travellerEmail],
			cc: reminder.type === "CLIENT" ? admins : undefined,
			subject: content.subject,
			text: content.text,
		});

		if (reminder.type === "CLIENT") {
			try {
				await sendEmail({
					to: admins,
					subject: `Client reminder sent: ${reminder.travellerName}`,
					text: [
						`The client reminder for ${reminder.travellerName} was submitted successfully.`,
						`Traveller email: ${reminder.travellerEmail}`,
						`Provider message ID: ${result.id ?? "unknown"}`,
					].join("\n"),
				});
			} catch (error) {
				console.error("Could not send administrator confirmation:", error);
			}
		}

		return { providerMessageId: result.id };
	};
}

export async function notifyDevelopers(subject: string, text: string) {
	const developers = emailList("DEVELOPER_EMAILS");

	await sendEmail({
		to: developers,
		subject,
		text,
	});
}
