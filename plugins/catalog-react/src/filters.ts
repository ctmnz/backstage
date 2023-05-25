/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Entity,
  parseEntityRef,
  RELATION_OWNED_BY,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { AlphaEntity } from '@backstage/catalog-model/alpha';
import { EntityFilter, UserListFilterKind } from './types';
import { getEntityRelations } from './utils';

/**
 * Filter entities based on Kind.
 * @public
 */
export class EntityKindFilter implements EntityFilter {
  constructor(readonly value: string) {}

  getCatalogFilters(): Record<string, string | string[]> {
    return { kind: this.value };
  }

  toQueryValue(): string {
    return this.value;
  }
}

/**
 * Filters entities based on type
 * @public
 */
export class EntityTypeFilter implements EntityFilter {
  constructor(readonly value: string | string[]) {}

  // Simplify `string | string[]` for consumers, always returns an array
  getTypes(): string[] {
    return Array.isArray(this.value) ? this.value : [this.value];
  }

  getCatalogFilters(): Record<string, string | string[]> {
    return { 'spec.type': this.getTypes() };
  }

  toQueryValue(): string[] {
    return this.getTypes();
  }
}

/**
 * Filters entities based on tag.
 * @public
 */
export class EntityTagFilter implements EntityFilter {
  constructor(readonly values: string[]) {}

  filterEntity(entity: Entity): boolean {
    return this.values.every(v => (entity.metadata.tags ?? []).includes(v));
  }

  getCatalogFilters(): Record<string, string | string[]> {
    return { 'metadata.tags': this.values };
  }

  toQueryValue(): string[] {
    return this.values;
  }
}

/**
 * Filters entities where the text matches spec, title or tags.
 * @public
 */
export class EntityTextFilter implements EntityFilter {
  constructor(readonly value: string) {}

  filterEntity(entity: Entity): boolean {
    const words = this.toUpperArray(this.value.split(/\s/));
    const exactMatch = this.toUpperArray([entity.metadata.tags]);
    const partialMatch = this.toUpperArray([
      entity.metadata.name,
      entity.metadata.title,
    ]);

    for (const word of words) {
      if (
        exactMatch.every(m => m !== word) &&
        partialMatch.every(m => !m.includes(word))
      ) {
        return false;
      }
    }

    return true;
  }

  private toUpperArray(
    value: Array<string | string[] | undefined>,
  ): Array<string> {
    return value
      .flat()
      .filter((m): m is string => Boolean(m))
      .map(m => m.toLocaleUpperCase('en-US'));
  }
}

/**
 * Filter matching entities that are owned by group.
 * @public
 *
 * CAUTION: This class may contain both full and partial entity refs.
 */
export class EntityOwnerFilter implements EntityFilter {
  readonly values: string[];
  constructor(values: string[]) {
    this.values = values.reduce((fullRefs, ref) => {
      // Attempt to remove bad entity references here.
      try {
        fullRefs.push(
          stringifyEntityRef(parseEntityRef(ref, { defaultKind: 'Group' })),
        );
        return fullRefs;
      } catch (err) {
        return fullRefs;
      }
    }, [] as string[]);
  }

  getCatalogFilters(): Record<string, string | string[]> {
    return { 'relations.ownedBy': this.values };
  }

  filterEntity(entity: Entity): boolean {
    return this.values.some(v =>
      getEntityRelations(entity, RELATION_OWNED_BY).some(
        o => stringifyEntityRef(o) === v,
      ),
    );
  }

  /**
   * Get the URL query parameter value. May be a mix of full and humanized entity refs.
   * @returns list of entity refs.
   */
  toQueryValue(): string[] {
    return this.values;
  }
}

/**
 * Filters entities on lifecycle.
 * @public
 */
export class EntityLifecycleFilter implements EntityFilter {
  constructor(readonly values: string[]) {}

  getCatalogFilters(): Record<string, string | string[]> {
    return { 'spec.lifecycle': this.values };
  }

  filterEntity(entity: Entity): boolean {
    return this.values.some(v => entity.spec?.lifecycle === v);
  }

  toQueryValue(): string[] {
    return this.values;
  }
}

/**
 * Filters entities to those within the given namespace(s).
 * @public
 */
export class EntityNamespaceFilter implements EntityFilter {
  constructor(readonly values: string[]) {}

  getCatalogFilters(): Record<string, string | string[]> {
    return { 'spec.lifecycle': this.values };
  }
  filterEntity(entity: Entity): boolean {
    return this.values.some(v => entity.metadata.namespace === v);
  }

  toQueryValue(): string[] {
    return this.values;
  }
}

/**
 * Filters entities based on whatever the user has starred or owns them.
 * @public
 */
export class UserListFilter implements EntityFilter {
  constructor(
    readonly value: UserListFilterKind,
    readonly isOwnedEntity: (entity: Entity) => boolean,
    readonly isStarredEntity: (entity: Entity) => boolean,
  ) {}

  filterEntity(entity: Entity): boolean {
    switch (this.value) {
      case 'owned':
        return this.isOwnedEntity(entity);
      case 'starred':
        return this.isStarredEntity(entity);
      default:
        return true;
    }
  }

  toQueryValue(): string {
    return this.value;
  }
}

/**
 * Filters entities based if it is an orphan or not.
 * @public
 */
export class EntityOrphanFilter implements EntityFilter {
  constructor(readonly value: boolean) {}

  getCatalogFilters(): Record<string, string | string[]> {
    return { 'metadata.annotations.backstage.io/orphan': String(this.value) };
  }

  filterEntity(entity: Entity): boolean {
    const orphan = entity.metadata.annotations?.['backstage.io/orphan'];
    return orphan !== undefined && this.value.toString() === orphan;
  }
}

/**
 * Filters entities based on if it has errors or not.
 * @public
 */
export class EntityErrorFilter implements EntityFilter {
  constructor(readonly value: boolean) {}

  // TODO(vinzscam): is it possible to implement
  // getCatalogFilters? ask mammals

  filterEntity(entity: Entity): boolean {
    const error =
      ((entity as AlphaEntity)?.status?.items?.length as number) > 0;
    return error !== undefined && this.value === error;
  }
}
