// lib/email/flight-reminder-template.ts

type DateLike = Date | { toString(): string };

export interface FlightReminderEmailData {
	// Existing Traveller fields
	clientName: string;
	email: string;

	// Existing Flight fields
	origin: string;
	destination: string;
	departureAt: DateLike;
	arrivalAt: DateLike;

	layoverCity?: string | null;
	layoverBeginsAt?: DateLike | null;
	layoverEndsAt?: DateLike | null;
	layoverDuration?: string | null;

	// Fields not currently available in our database.
	// These remain optional placeholders until we add them.
	flightNumber?: string | null;
	bookingReference?: string | null;
	bookingDate?: string | null;
	airlineName?: string | null;
	airlineLogoUrl?: string | null;
	flightBannerImageUrl?: string | null;
	manageBookingUrl?: string | null;
	reminderType?: "ADMIN" | "CLIENT";
	enableLiveCountdown?: boolean;
}

/**
 * IMPORTANT:
 * The flight dates/times from the Google Sheet are treated as
 * local/floating values. We deliberately use the stored Date
 * components instead of converting them to another timezone.
 */
function toDate(date: DateLike): Date {
	return date instanceof Date ? date : new Date(date.toString());
}

function formatDate(value: DateLike): string {
	const date = toDate(value);
	const day = String(date.getUTCDate()).padStart(2, "0");
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const year = date.getUTCFullYear();

	return `${day}/${month}/${year}`;
}

function formatTime(value: DateLike): string {
	const date = toDate(value);
	const hour24 = date.getUTCHours();
	const hours = hour24 % 12 || 12;
	const minutes = String(date.getUTCMinutes()).padStart(2, "0");
	const period = hour24 >= 12 ? "PM" : "AM";

	return `${hours}:${minutes} ${period}`;
}

function formatDateAndTime(value: DateLike): string {
	return `${formatDate(value)} at ${formatTime(value)}`;
}

/**
 * Calculates the number of days remaining while treating
 * the database date/time components as local values.
 */
function getDaysUntilDeparture(departureAt: DateLike): number {
	const now = new Date();
	const departure = toDate(departureAt);

	const departureLocal = Date.UTC(
		departure.getUTCFullYear(),
		departure.getUTCMonth(),
		departure.getUTCDate(),
		departure.getUTCHours(),
		departure.getUTCMinutes(),
		departure.getUTCSeconds(),
	);

	const nowLocal = Date.UTC(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		now.getHours(),
		now.getMinutes(),
		now.getSeconds(),
	);

	const difference = departureLocal - nowLocal;

	return Math.max(0, Math.ceil(difference / (1000 * 60 * 60 * 24)));
}

function formatCountdown(targetMilliseconds: number): string {
	const remainingSeconds = Math.max(
		0,
		Math.floor((targetMilliseconds - Date.now()) / 1000),
	);
	const hours = Math.floor(remainingSeconds / 3600);
	const minutes = Math.floor((remainingSeconds % 3600) / 60);
	const seconds = remainingSeconds % 60;

	return [hours, minutes, seconds]
		.map((value) => String(value).padStart(2, "0"))
		.join(":");
}

export function flightReminderTemplate(data: FlightReminderEmailData): string {
	const {
		clientName,
		origin,
		destination,
		departureAt,
		arrivalAt,
		layoverCity,
		layoverBeginsAt,
		layoverEndsAt,
		layoverDuration,

		flightNumber,
		bookingReference,
		bookingDate,
		airlineName,
		airlineLogoUrl,
		flightBannerImageUrl,
		manageBookingUrl,
		reminderType = "CLIENT",
		enableLiveCountdown,
	} = data;

	const daysUntilDeparture = getDaysUntilDeparture(departureAt);

	const displayAirline = airlineName || "{{AIRLINE_NAME}}";
	const displayFlightNumber = flightNumber || "{{FLIGHT_NUMBER}}";

	const displayBookingReference = bookingReference || "{{BOOKING_REFERENCE}}";

	const displayBookingDate = bookingDate || "{{BOOKING_DATE}}";

	const logo = airlineLogoUrl || "{{AIRLINE_LOGO_URL}}";

	const banner = flightBannerImageUrl || "{{FLIGHT_BANNER_IMAGE_URL}}";

	const manageUrl = manageBookingUrl || "{{MANAGE_BOOKING_URL}}";
	const departureMilliseconds = toDate(departureAt).getTime();
	const hourMilliseconds = 60 * 60 * 1000;
	const countdown =
		reminderType === "ADMIN"
			? {
					label: "48-hour admin reminder",
					target: departureMilliseconds - 48 * hourMilliseconds,
				}
			: {
					label: "24-hour client reminder",
					target: departureMilliseconds - 24 * hourMilliseconds,
				};
	const countdownScript = enableLiveCountdown
		? `
<script>
  (() => {
    const countdowns = document.querySelectorAll("[data-countdown-target]");

    const updateCountdowns = () => {
      const now = Date.now();

      countdowns.forEach((element) => {
        const target = Number(element.getAttribute("data-countdown-target"));
        const remainingSeconds = Math.max(0, Math.floor((target - now) / 1000));
        const hours = String(Math.floor(remainingSeconds / 3600)).padStart(2, "0");
        const minutes = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, "0");
        const seconds = String(remainingSeconds % 60).padStart(2, "0");
        element.textContent = hours + ":" + minutes + ":" + seconds;
      });
    };

    updateCountdowns();
    window.setInterval(updateCountdowns, 1000);
  })();
</script>
`
		: "";

	const layoverSection = layoverCity
		? `
        <tr>
          <td width="22" valign="top">•</td>
          <td>
            <strong>Layover City:</strong>
            ${layoverCity}
          </td>
        </tr>

        ${
					layoverBeginsAt && layoverEndsAt
						? `
              <tr>
                <td width="22" valign="top">•</td>
                <td>
                  <strong>Layover Time:</strong>
                  ${formatTime(layoverBeginsAt)}
                  –
                  ${formatTime(layoverEndsAt)}
                  ${layoverDuration ? ` (${layoverDuration})` : ""}
                </td>
              </tr>
            `
						: ""
				}
      `
		: "";

	return `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>Flight Reminder</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background-color:#f4f4f6;
    font-family:Arial,Helvetica,sans-serif;
    color:#333333;
  "
>

<table
  role="presentation"
  width="100%"
  max-width="900px"
  cellspacing="0"
  cellpadding="0"
  border="0"
  style="
    background-color:#f4f4f6;
    padding:20px 0;
  "
>
  <tr>
    <td align="center">

      <!-- EMAIL CARD -->
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          max-width:700px;
          background-color:#ffffff;
          margin:0 auto;
        "
      >

        <!-- AIRLINE HEADER -->
        <tr>
          <td
            style="
              background-color:#eeeeee;
              padding:28px 40px;
              text-align:center;
            "
          >

            ${
							airlineLogoUrl
								? `
                  <img
                    src="${logo}"
                    alt="${displayAirline}"
                    style="
                      max-width:200px;
                      width:100%;
                      height:150px;
                      display:block;
                      margin:0 auto;
                    "
                  />
                `
								: `
                  <div
                    style="
                      font-size:30px;
                      font-weight:700;
                      color:#008c45;
                    "
                  >
                    ${displayAirline}
                  </div>
                `
						}

          </td>
        </tr>


        <!-- FLIGHT BANNER -->
        ${
					flightBannerImageUrl
						? `
              <tr>
                <td style="padding:0;">

                  <img
                    src="${banner}"
                    alt="Your upcoming flight"
                    width="900"
                    style="
                      width:100%;
                      // max-width:600px;
                      height:200px;
                      display:block;
                    "
                  />

                </td>
              </tr>
            `
						: ""
				}


        <!-- TITLE + BOOKING -->
        <tr>
          <td style="padding:48px 70px 20px 70px;">

            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
            >

              <tr>

                <!-- LEFT -->
                <td
                  valign="top"
                  style="
                    width:55%;
                    padding-right:20px;
                  "
                >

                  <h1
                    style="
                      margin:0;
                      font-size:32px;
                      line-height:1.15;
                      color:#111111;
                      font-weight:700;
                    "
                  >
                    Get ready for your<br />
                    trip to ${destination}
                  </h1>

                  <p
                    style="
                      margin:12px 0 0 0;
                      font-size:18px;
                      color:#555555;
                    "
                  >
                    ${origin}
                    to
                    ${destination}
                    ·
                    ${displayFlightNumber}
                  </p>

                </td>


                <!-- RIGHT -->
                <td
                  valign="top"
                  align="right"
                  style="width:45%;"
                >

                  <p
                    style="
                      margin:0 0 8px 0;
                      font-size:17px;
                      color:#555555;
                    "
                  >
                    Booking ref:
                  </p>

                  <div
                    style="
                      background-color:#CECECE;
                      color:#000000;
                      font-size:18px;
                      font-weight:700;
                      padding:9px 18px;
                      border-radius:3px;
                      display:inline-block;
                      min-width:150px;
                      text-align:center;
                    "
                  >
                    ${displayBookingReference}
                  </div>

                  <p
                    style="
                      margin:10px 0 0 0;
                      font-size:16px;
                      color:#555555;
                    "
                  >
                    Booked on ${displayBookingDate}
                  </p>

                </td>

              </tr>

            </table>

          </td>
        </tr>


        <!-- GREETING -->
        <tr>
          <td style="padding:15px 70px 20px 70px;">

            <p
              style="
                margin:0 0 25px 0;
                font-size:17px;
                line-height:1.6;
                color:#555555;
              "
            >
              Dear <strong>${clientName}</strong>,
            </p>

            <p
              style="
                margin:0;
                font-size:17px;
                line-height:1.6;
                color:#555555;
              "
            >
              Your trip to
              ${destination}
              is just
              <strong>
                ${daysUntilDeparture}
                ${daysUntilDeparture === 1 ? "day" : "days"}
                away!
              </strong>

              We wanted to remind you of the details
              of your upcoming flight and help you prepare
              for a smooth journey.
            </p>

          </td>
        </tr>


        <!-- REMINDER COUNTDOWNS -->
        <tr>
          <td style="padding:10px 70px 20px 70px;">

            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
              style="background-color:#f4f8f5; border-left:4px solid #008c45;"
            >
              <tr>
                <td style="padding:18px 20px 8px 20px;">
                  <strong style="font-size:18px; color:#222222;">Reminder countdown</strong>
                </td>
                <td
                  align="right"
                  valign="top"
                  style="padding:15px 20px 0 10px; font-size:28px; line-height:1;"
                  aria-label="Clock"
                >
                  &#128336;
                </td>
              </tr>
              ${`
              <tr>
                <td colspan="2" style="padding:5px 20px 15px 20px;">
                  <span style="display:block; color:#65736d; font-size:13px;">${countdown.label}</span>
                  <strong
                    data-countdown-target="${countdown.target}"
                    style="display:block; margin-top:3px; color:#008c45; font-size:26px; letter-spacing:2px;"
                  >
                    ${formatCountdown(countdown.target)}
                  </strong>
                </td>
              </tr>
            `}
            </table>

          </td>
        </tr>


        <!-- FLIGHT DETAILS -->
        <tr>
          <td style="padding:20px 70px;">

            <h2
              style="
                margin:0 0 18px 0;
                font-size:20px;
                color:#444444;
                font-weight:500;
              "
            >
              Flight Details:
            </h2>


            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
              style="
                font-size:16px;
                line-height:1.7;
                color:#555555;
              "
            >

              <tr>
                <td width="22" valign="top">•</td>

                <td>
                  <strong>Flight Number:</strong>
                  ${displayFlightNumber}
                </td>
              </tr>


              <tr>
                <td width="22" valign="top">•</td>

                <td>
                  <strong>Airline:</strong>
                  ${displayAirline}
                </td>
              </tr>


              <tr>
                <td width="22" valign="top">•</td>

                <td>
                  <strong>Origin:</strong>
                  ${origin}
                </td>
              </tr>


              <tr>
                <td width="22" valign="top">•</td>

                <td>
                  <strong>Destination:</strong>
                  ${destination}
                </td>
              </tr>


              <tr>
                <td width="22" valign="top">•</td>

                <td>
                  <strong>Departure Date and Time:</strong>
                  ${formatDateAndTime(departureAt)}
                </td>
              </tr>


              <tr>
                <td width="22" valign="top">•</td>

                <td>
                  <strong>Arrival Date and Time:</strong>
                  ${formatDateAndTime(arrivalAt)}
                </td>
              </tr>


              ${layoverSection}

            </table>

          </td>
        </tr>


        <!-- MANAGE BOOKING MESSAGE -->
        <tr>
          <td style="padding:20px 70px 10px 70px;">

            <p
              style="
                margin:0;
                font-size:16px;
                line-height:1.6;
                color:#555555;
              "
            >
              To make any changes to your booking or
              update your document details for faster
              check-in, please click on the
              <strong>"Manage Booking"</strong>
              button below.
            </p>

          </td>
        </tr>


        <!-- MANAGE BOOKING BUTTON -->
        <tr>
          <td
            align="center"
            style="padding:25px 70px 45px 70px;"
          >

            <a
              href="${manageUrl}"
              target="_blank"
              style="
                display:inline-block;
                background-color:#CAA001;
                color:#ffffff;
                text-decoration:none;
                font-size:18px;
                font-weight:700;
                padding:17px 70px;
                border-radius:3px;
              "
            >
              Manage Booking
            </a>

          </td>
        </tr>


        <!-- FOOTER -->
        <tr>
          <td
            style="
              border-top:1px solid #dddddd;
              padding:25px 70px 35px 70px;
              text-align:center;
            "
          >

            <p
              style="
                margin:0;
                font-size:13px;
                line-height:1.5;
                color:#888888;
              "
            >
              This is an automated flight reminder.
              Please do not reply directly to this email.
            </p>

          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

${countdownScript}
</body>
</html>
  `.trim();
}
