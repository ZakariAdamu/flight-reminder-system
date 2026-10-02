// lib/email/flight-reminder-template.ts

export interface FlightReminderEmailData {
	// Existing Traveller fields
	clientName: string;
	email: string;

	// Existing Flight fields
	origin: string;
	destination: string;
	departureAt: Date;
	arrivalAt: Date;

	layoverCity?: string | null;
	layoverBeginsAt?: Date | null;
	layoverEndsAt?: Date | null;
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
}

/**
 * IMPORTANT:
 * The flight dates/times from the Google Sheet are treated as
 * local/floating values. We deliberately use the stored Date
 * components instead of converting them to another timezone.
 */
function formatDate(date: Date): string {
	const day = String(date.getUTCDate()).padStart(2, "0");
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const year = date.getUTCFullYear();

	return `${day}/${month}/${year}`;
}

function formatTime(date: Date): string {
	const hours = String(date.getUTCHours()).padStart(2, "0");
	const minutes = String(date.getUTCMinutes()).padStart(2, "0");

	return `${hours}:${minutes}`;
}

function formatDateAndTime(date: Date): string {
	return `${formatDate(date)} at ${formatTime(date)}`;
}

/**
 * Calculates the number of days remaining while treating
 * the database date/time components as local values.
 */
function getDaysUntilDeparture(departureAt: Date): number {
	const now = new Date();

	const departureLocal = Date.UTC(
		departureAt.getUTCFullYear(),
		departureAt.getUTCMonth(),
		departureAt.getUTCDate(),
		departureAt.getUTCHours(),
		departureAt.getUTCMinutes(),
		departureAt.getUTCSeconds(),
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
	} = data;

	const daysUntilDeparture = getDaysUntilDeparture(departureAt);

	const displayAirline = airlineName || "{{AIRLINE_NAME}}";
	const displayFlightNumber = flightNumber || "{{FLIGHT_NUMBER}}";

	const displayBookingReference = bookingReference || "{{BOOKING_REFERENCE}}";

	const displayBookingDate = bookingDate || "{{BOOKING_DATE}}";

	const logo = airlineLogoUrl || "{{AIRLINE_LOGO_URL}}";

	const banner = flightBannerImageUrl || "{{FLIGHT_BANNER_IMAGE_URL}}";

	const manageUrl = manageBookingUrl || "{{MANAGE_BOOKING_URL}}";

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
          max-width:900px;
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
                      max-width:320px;
                      width:100%;
                      height:auto;
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
                      max-width:900px;
                      height:auto;
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
                      background-color:#000000;
                      color:#ffffff;
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
                background-color:#008c45;
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

</body>
</html>
  `.trim();
}
