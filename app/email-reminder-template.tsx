import { flightReminderTemplate } from "../lib/email/flight-reminder-template";
import { db, ensureDatabaseConnection } from "../lib/db";

export const dynamic = "force-dynamic";

const EmailReminderTemplate = async () => {
	await ensureDatabaseConnection();
	const flight = await db.orm.public.Flight.include("traveller")
		.orderBy((item) => item.departureAt.asc())
		.first();

	if (!flight) {
		return (
			<main style={{ padding: "32px" }}>No synced flights available.</main>
		);
	}

	const emailHtml = flightReminderTemplate({
		clientName: flight.traveller.name,
		email: flight.traveller.email,
		origin: flight.origin,
		destination: flight.destination,
		departureAt: flight.departureAt,
		arrivalAt: flight.arrivalAt ?? flight.departureAt,
		layoverCity: flight.layoverCity,
		layoverBeginsAt: flight.layoverBeginsAt,
		layoverEndsAt: flight.layoverEndsAt,
		layoverDuration: flight.layoverDuration,
		airlineName: process.env.AIRLINE_NAME,
		airlineLogoUrl: process.env.EMAIL_LOGO_URL,
		flightBannerImageUrl: process.env.EMAIL_BANNER_IMAGE_URL,
		manageBookingUrl: process.env.MANAGE_BOOKING_URL,
		reminderType: "CLIENT",
		enableLiveCountdown: true,
	});

	return (
		<main
			style={{
				minHeight: "100vh",
				background: "#e8ece8",
				padding: "32px 16px",
			}}
		>
			<iframe
				title="Flight reminder email preview"
				srcDoc={emailHtml}
				style={{
					width: "100%",
					height: "1800px",
					maxWidth: "960px",
					display: "block",
					margin: "0 auto",
					border: "0",
					background: "#ffffff",
				}}
			/>
		</main>
	);
};

export default EmailReminderTemplate;
