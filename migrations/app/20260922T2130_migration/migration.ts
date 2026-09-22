#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5743c851c43874f6e24bb17311ca7e32f4842d6510949bd9045bfcca02ed0484/contract';
import endContract from '../../snapshots/5743c851c43874f6e24bb17311ca7e32f4842d6510949bd9045bfcca02ed0484/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'auditLog',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('eventType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('metadata', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reminderId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('travellerId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'auditLog_eventType_check_48274968',
            "\"eventType\" IN ('TRAVELLER_CREATED', 'TRAVELLER_UPDATED', 'FLIGHT_CREATED', 'FLIGHT_UPDATED', 'REMINDER_CREATED', 'REMINDER_DUE', 'ADMIN_ADVANCE_NOTIFICATION_SENT', 'TRAVELLER_REMINDER_SENT', 'ADMIN_CONFIRMATION_SENT', 'REMINDER_FAILED', 'REMINDER_RETRY_SCHEDULED', 'REMINDER_CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'flight',
        columns: [
          col('arrivalAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('departureAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('destination', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('layoverBeginsAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('layoverCity', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('layoverDuration', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('layoverEndsAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('origin', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sheetRow', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('travellerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'reminder',
        columns: [
          col('attemptCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('errorMessage', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('failedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('flightId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nextAttemptAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('providerMessageId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reminderId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('scheduledFor', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('sentAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'reminder_status_check_03803961',
            "\"status\" IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'traveller',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('location', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sheetRow', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'flight',
        constraint: 'flight_sheetRow_key',
        columns: ['sheetRow'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'reminder',
        constraint: 'reminder_reminderId_key',
        columns: ['reminderId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'reminder',
        constraint: 'reminder_flightId_key',
        columns: ['flightId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'traveller',
        constraint: 'traveller_sheetRow_key',
        columns: ['sheetRow'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'traveller',
        constraint: 'traveller_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditLog',
        index: 'auditLog_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditLog',
        index: 'auditLog_eventType_idx_e4cf7742',
        columns: ['eventType'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditLog',
        index: 'auditLog_reminderId_idx_273293f9',
        columns: ['reminderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditLog',
        index: 'auditLog_travellerId_idx_6409e652',
        columns: ['travellerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'flight',
        index: 'flight_travellerId_idx_6409e652',
        columns: ['travellerId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'auditLog',
        foreignKey: {
          name: 'auditLog_travellerId_fkey',
          columns: ['travellerId'],
          references: { schema: 'public', table: 'traveller', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'auditLog',
        foreignKey: {
          name: 'auditLog_reminderId_fkey',
          columns: ['reminderId'],
          references: { schema: 'public', table: 'reminder', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'flight',
        foreignKey: {
          name: 'flight_travellerId_fkey',
          columns: ['travellerId'],
          references: { schema: 'public', table: 'traveller', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'reminder',
        foreignKey: {
          name: 'reminder_flightId_fkey',
          columns: ['flightId'],
          references: { schema: 'public', table: 'flight', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
