#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/b86293baf2f47fc8bc6d672c427d22d7f1b39a5e8f640a70001e758c3cedc002/contract';
import startContract from '../../snapshots/b86293baf2f47fc8bc6d672c427d22d7f1b39a5e8f640a70001e758c3cedc002/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e7507f73b4738f34d2ac29a3cebd9a7395d0b0da176e595d74cbf761c357965a/contract';
import endContract from '../../snapshots/e7507f73b4738f34d2ac29a3cebd9a7395d0b0da176e595d74cbf761c357965a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropTable({ schema: 'public', table: 'validationIssue' })];
  }
}

MigrationCLI.run(import.meta.url, M);
