#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4a9ea83b4267d6eea3e1bce88ac21baac2c031550452c9e90ef30ea7c10ffbfe/contract';
import endContract from '../../snapshots/4a9ea83b4267d6eea3e1bce88ac21baac2c031550452c9e90ef30ea7c10ffbfe/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e7507f73b4738f34d2ac29a3cebd9a7395d0b0da176e595d74cbf761c357965a/contract';
import startContract from '../../snapshots/e7507f73b4738f34d2ac29a3cebd9a7395d0b0da176e595d74cbf761c357965a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'reminder',
        constraint: 'reminder_status_check_03803961',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'reminder',
        constraint: 'reminder_status_check_7116ce52',
        expression:
          "\"status\" IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
