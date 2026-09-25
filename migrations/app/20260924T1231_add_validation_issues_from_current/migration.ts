#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b86293baf2f47fc8bc6d672c427d22d7f1b39a5e8f640a70001e758c3cedc002/contract';
import endContract from '../../snapshots/b86293baf2f47fc8bc6d672c427d22d7f1b39a5e8f640a70001e758c3cedc002/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f32f24c63bfb30c97c6a30525daa8ff73c7f48d6f2890cd160684af7fdd88e2c/contract';
import startContract from '../../snapshots/f32f24c63bfb30c97c6a30525daa8ff73c7f48d6f2890cd160684af7fdd88e2c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'traveller',
        constraint: 'traveller_sheetRow_key',
      }),
      this.dropColumn({ schema: 'public', table: 'traveller', column: 'sheetRow' }),
      this.createTable({
        schema: 'public',
        table: 'validationIssue',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('field', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fingerprint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('firstSeenAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastSeenAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resolvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sheetRow', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('value', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'validationIssue',
        constraint: 'validationIssue_fingerprint_key',
        columns: ['fingerprint'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'validationIssue',
        index: 'validationIssue_resolvedAt_idx_a13a9d8d',
        columns: ['resolvedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'validationIssue',
        index: 'validationIssue_severity_idx_5b070f41',
        columns: ['severity'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'validationIssue',
        index: 'validationIssue_sheetRow_idx_2c3c0125',
        columns: ['sheetRow'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
