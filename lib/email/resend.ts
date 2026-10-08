import type { ReminderSender, ReminderToSend } from "../reminder-processing";
import { flightReminderTemplate } from "./flight-reminder-template";

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

function optionalEnv(name: string): string | undefined {
	const value = process.env[name]?.trim();
	return value || undefined;
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
	html?: string;
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
			...(input.html ? { html: input.html } : {}),
		}),
	});

	if (!response.ok) {
		const detail = await response.text();
		throw new Error(`Resend API ${response.status}: ${detail}`);
	}

	return (await response.json()) as ResendResponse;
}

function reminderContent(reminder: ReminderToSend) {
	const timing = reminder.type === "ADMIN" ? "48hrs" : "24hrs";

	return {
		subject: `${timing} flight reminder for ${reminder.travellerName}`,
		text: `Hello ${reminder.travellerName},\n\nYour flight reminder is ready.`,
		html: flightReminderTemplate({
			clientName: reminder.travellerName,
			email: reminder.travellerEmail,
			origin: reminder.origin,
			destination: reminder.destination,
			departureAt: reminder.departureAt,
			arrivalAt: reminder.arrivalAt ?? reminder.departureAt,
			layoverCity: reminder.layoverCity,
			layoverBeginsAt: reminder.layoverBeginsAt,
			layoverEndsAt: reminder.layoverEndsAt,
			layoverDuration: reminder.layoverDuration,
			airlineName: optionalEnv("AIRLINE_NAME"),
			airlineLogoUrl: optionalEnv("EMAIL_LOGO_URL"),
			flightBannerImageUrl: optionalEnv("EMAIL_BANNER_IMAGE_URL"),
			manageBookingUrl: optionalEnv("MANAGE_BOOKING_URL"),
			reminderType: reminder.type,
		}),
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
			html: content.html,
		});

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
