"use client";

import { useMemo, useState } from "react";

import type { DashboardData } from "../lib/dashboard";

type View = "travellers" | "audit";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
	day: "2-digit",
	month: "short",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

function formatDate(value: string) {
	return dateFormatter.format(new Date(value));
}

function statusClass(status: string) {
	return `status status-${status.toLowerCase()}`;
}

export function DashboardClient({ data }: { data: DashboardData }) {
	const [view, setView] = useState<View>("travellers");
	const [search, setSearch] = useState("");
	const searchTerm = search.trim().toLowerCase();
	const filteredSheetRows = useMemo(
		() =>
			data.sheet.rows.filter((row) =>
				row.join(" ").toLowerCase().includes(searchTerm),
			),
		[data.sheet.rows, searchTerm],
	);
	const filteredFlights = useMemo(
		() =>
			data.flights.filter((flight) =>
				[
					flight.traveller.name,
					flight.traveller.email,
					flight.origin,
					flight.destination,
					String(flight.sheetRow),
				]
					.join(" ")
					.toLowerCase()
					.includes(searchTerm),
			),
		[data.flights, searchTerm],
	);
	const failedReminders = data.flights.reduce(
		(total, flight) =>
			total +
			flight.reminders.filter((reminder) => reminder.status === "FAILED")
				.length,
		0,
	);

	return (
		<main className="dashboard-shell">
			<header className="dashboard-header">
				<div>
					<p className="eyebrow">Marquis Concierge / Operations</p>
					<h1>Flight control room</h1>
					<p className="subtitle">
						A live view of traveller records, data quality, and notification
						history.
					</p>
				</div>
				<div className="header-mark" aria-hidden="true">
					FC
				</div>
			</header>

			<section className="sheet-source" aria-labelledby="sheet-heading">
				<div className="sheet-source-header">
					<div>
						<p className="eyebrow">Source of truth</p>
						<h2 id="sheet-heading">Google Sheets records</h2>
						<p className="section-subtitle">
							Raw rows are shown before synchronization and reminder
							calculations.
						</p>
					</div>
					<div className="sheet-counts" aria-label="Sheet row counts">
						<span>{data.sheet.rows.length} rows</span>
						<span>{data.sheet.emptyRows} empty</span>
						<span>{data.sheet.cancelledRows} cancelled</span>
					</div>
				</div>
				<div className="toolbar">
					<label className="search-box">
						<span className="sr-only">Search Sheet rows</span>
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search Sheet rows"
						/>
					</label>
				</div>
				<SheetView headers={data.sheet.headers} rows={filteredSheetRows} />
			</section>

			<UpcomingReminder reminder={data.upcomingReminder} />

			<section className="metric-grid" aria-label="System summary">
				<div className="metric metric-primary">
					<span>Flights tracked</span>
					<strong>{data.flights.length}</strong>
					<small>Latest synchronized records</small>
				</div>
				<div className="metric">
					<span>Audit events</span>
					<strong>{data.auditLogs.length}</strong>
					<small>Recent operational history</small>
				</div>
				<div className="metric">
					<span>Reminder failures</span>
					<strong className={failedReminders ? "metric-alert" : ""}>
						{failedReminders}
					</strong>
					<small>Requires operational review</small>
				</div>
			</section>

			<section className="workspace">
				<nav className="view-tabs" aria-label="Dashboard views">
					{(["travellers", "audit"] as const).map((tab) => (
						<button
							className={view === tab ? "tab-active" : ""}
							key={tab}
							onClick={() => setView(tab)}
						>
							{tab === "travellers" ? "Travellers & flights" : "Audit log"}
						</button>
					))}
				</nav>
				<div className="toolbar">
					<label className="search-box">
						<span className="sr-only">Search current view</span>
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search travellers, routes, or rows"
						/>
					</label>
				</div>

				{view === "travellers" && <TravellerView flights={filteredFlights} />}
				{view === "audit" && <AuditView logs={data.auditLogs} />}
			</section>
		</main>
	);
}

function UpcomingReminder({
	reminder,
}: {
	reminder: DashboardData["upcomingReminder"];
}) {
	if (!reminder) {
		return (
			<section className="upcoming-reminder" aria-labelledby="upcoming-heading">
				<div>
					<p className="eyebrow">Next operation</p>
					<h2 id="upcoming-heading">Upcoming reminder</h2>
					<p className="section-subtitle">
						No pending or retryable reminders are waiting to be processed.
					</p>
				</div>
			</section>
		);
	}

	return (
		<section className="upcoming-reminder" aria-labelledby="upcoming-heading">
			<div className="upcoming-header">
				<div>
					<p className="eyebrow">Next operation</p>
					<h2 id="upcoming-heading">Upcoming reminder</h2>
				</div>
				<span className={statusClass(reminder.status)}>
					{reminder.type} · {reminder.status}
				</span>
			</div>
			<div className="upcoming-grid">
				<div>
					<span className="detail-label">Process at</span>
					<strong>{formatDate(reminder.processAt)}</strong>
					<small>Scheduled for {formatDate(reminder.scheduledFor)}</small>
				</div>
				<div>
					<span className="detail-label">Traveller</span>
					<strong>{reminder.traveller.name}</strong>
					<small>{reminder.traveller.email}</small>
				</div>
				<div>
					<span className="detail-label">Flight</span>
					<strong>
						{reminder.flight.origin} <span className="route-arrow">→</span>{" "}
						{reminder.flight.destination}
					</strong>
					<small>Sheet row #{reminder.flight.sheetRow}</small>
				</div>
				<div>
					<span className="detail-label">Attempts</span>
					<strong>{reminder.attemptCount}</strong>
					<small>{reminder.reminderId}</small>
				</div>
			</div>
			{reminder.errorMessage && (
				<p className="upcoming-error">Last error: {reminder.errorMessage}</p>
			)}
		</section>
	);
}

function SheetView({ headers, rows }: { headers: string[]; rows: string[][] }) {
	return (
		<div className="table-wrap">
			<table className="sheet-table">
				<thead>
					<tr>
						{headers.map((header) => (
							<th key={header}>{header}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, rowIndex) => (
						<tr key={`${rowIndex}-${row.join("|")}`}>
							{headers.map((header, columnIndex) => (
								<td key={`${header}-${columnIndex}`}>{row[columnIndex]}</td>
							))}
						</tr>
					))}
					{rows.length === 0 && (
						<EmptyRow
							colSpan={Math.max(headers.length, 1)}
							message="No Sheet rows match this search."
						/>
					)}
				</tbody>
			</table>
		</div>
	);
}

function TravellerView({ flights }: { flights: DashboardData["flights"] }) {
	return (
		<div className="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Traveller</th>
						<th>Route</th>
						<th>Departure</th>
						<th>Reminders</th>
						<th>Sheet row</th>
					</tr>
				</thead>
				<tbody>
					{flights.map((flight) => (
						<tr key={flight.id}>
							<td>
								<strong>{flight.traveller.name}</strong>
								<span>{flight.traveller.email}</span>
							</td>
							<td>
								<strong>
									{flight.origin} <span className="route-arrow">→</span>{" "}
									{flight.destination}
								</strong>
								<span>{flight.traveller.location ?? "Location not set"}</span>
							</td>
							<td>{formatDate(flight.departureAt)}</td>
							<td>
								<div className="reminder-stack">
									{flight.reminders.map((reminder) => (
										<span
											className={statusClass(reminder.status)}
											key={reminder.type}
										>
											{reminder.type} · {reminder.status}
										</span>
									))}
								</div>
							</td>
							<td className="muted">#{flight.sheetRow}</td>
						</tr>
					))}
					{flights.length === 0 && (
						<EmptyRow message="No traveller records match this search." />
					)}
				</tbody>
			</table>
		</div>
	);
}

function AuditView({ logs }: { logs: DashboardData["auditLogs"] }) {
	return (
		<div className="audit-list">
			{logs.map((log) => (
				<article className="audit-entry" key={log.id}>
					<div className="audit-dot" />
					<div>
						<div className="audit-meta">
							<strong>{log.eventType.replaceAll("_", " ")}</strong>
							<time>{formatDate(log.createdAt)}</time>
						</div>
						<p>{log.message}</p>
						<small>
							{log.travellerName ?? "System event"}
							{log.reminderType ? ` · ${log.reminderType} reminder` : ""}
						</small>
					</div>
				</article>
			))}
			{logs.length === 0 && (
				<p className="empty-state">No audit events have been recorded yet.</p>
			)}
		</div>
	);
}

function EmptyRow({
	message,
	colSpan = 5,
}: {
	message: string;
	colSpan?: number;
}) {
	return (
		<tr>
			<td className="empty-cell" colSpan={colSpan}>
				{message}
			</td>
		</tr>
	);
}
