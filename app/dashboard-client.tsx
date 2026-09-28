"use client";

import { useMemo, useState } from "react";

import type { DashboardData } from "../lib/dashboard";

type View = "travellers" | "issues" | "audit";

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
	const [severity, setSeverity] = useState("ALL");

	const searchTerm = search.trim().toLowerCase();
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
	const filteredIssues = data.validationIssues.filter(
		(issue) =>
			(severity === "ALL" || issue.severity === severity) &&
			[issue.message, issue.code, issue.field ?? "", String(issue.sheetRow)]
				.join(" ")
				.toLowerCase()
				.includes(searchTerm),
	);
	const errorCount = data.validationIssues.filter(
		(issue) => issue.severity === "ERROR",
	).length;
	const warningCount = data.validationIssues.filter(
		(issue) => issue.severity === "WARNING",
	).length;
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

			<section className="metric-grid" aria-label="System summary">
				<div className="metric metric-primary">
					<span>Flights tracked</span>
					<strong>{data.flights.length}</strong>
					<small>Latest synchronized records</small>
				</div>
				<div className="metric">
					<span>Open issues</span>
					<strong>{data.validationIssues.length}</strong>
					<small>
						{errorCount} errors / {warningCount} warnings
					</small>
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
					{(["travellers", "issues", "audit"] as const).map((tab) => (
						<button
							className={view === tab ? "tab-active" : ""}
							key={tab}
							onClick={() => setView(tab)}
						>
							{tab === "travellers"
								? "Travellers & flights"
								: tab === "issues"
									? `Validation issues (${data.validationIssues.length})`
									: "Audit log"}
						</button>
					))}
				</nav>
				<div className="toolbar">
					<label className="search-box">
						<span className="sr-only">Search current view</span>
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={
								view === "issues"
									? "Search issues, codes, or rows"
									: "Search travellers, routes, or rows"
							}
						/>
					</label>
					{view === "issues" && (
						<select
							value={severity}
							onChange={(event) => setSeverity(event.target.value)}
							aria-label="Filter validation severity"
						>
							<option value="ALL">All severities</option>
							<option value="ERROR">Errors</option>
							<option value="WARNING">Warnings</option>
							<option value="INFO">Info</option>
						</select>
					)}
				</div>

				{view === "travellers" && <TravellerView flights={filteredFlights} />}
				{view === "issues" && <IssuesView issues={filteredIssues} />}
				{view === "audit" && <AuditView logs={data.auditLogs} />}
			</section>
		</main>
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

function IssuesView({ issues }: { issues: DashboardData["validationIssues"] }) {
	return (
		<div className="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Severity</th>
						<th>Sheet row</th>
						<th>Field</th>
						<th>Issue</th>
						<th>First detected</th>
					</tr>
				</thead>
				<tbody>
					{issues.map((issue) => (
						<tr key={issue.id}>
							<td>
								<span
									className={`severity severity-${issue.severity.toLowerCase()}`}
								>
									{issue.severity}
								</span>
							</td>
							<td>#{issue.sheetRow}</td>
							<td>{issue.field ?? "General"}</td>
							<td>
								<strong>{issue.code}</strong>
								<span>
									{issue.message}
									{issue.value ? ` Value: ${issue.value}` : ""}
								</span>
							</td>
							<td className="muted">{formatDate(issue.firstSeenAt)}</td>
						</tr>
					))}
					{issues.length === 0 && (
						<EmptyRow message="No open validation issues match this filter." />
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

function EmptyRow({ message }: { message: string }) {
	return (
		<tr>
			<td className="empty-cell" colSpan={5}>
				{message}
			</td>
		</tr>
	);
}
