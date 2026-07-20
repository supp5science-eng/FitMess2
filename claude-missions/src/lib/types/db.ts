/**
 * Hand-authored TypeScript types for the Postgres schema created by
 * `supabase/migrations/0001_profiles.sql` (F010).
 *
 * These mirror the shape the Supabase CLI's `supabase gen types typescript`
 * would produce (a `Database` interface keyed by schema -> table ->
 * Row/Insert/Update), so `createClient<Database>(...)` / `createAdminClient
 * <Database>(...)` can be adopted by later features without changing this
 * file's public shape. Regenerate via the Supabase CLI/MCP once either is
 * reachable from a worker session and diff against this file rather than
 * hand-editing types out of sync with a migration -- see the F010 handoff
 * for why this had to be hand-authored instead this time.
 *
 * `public.profiles`, `public.targets`, `public.foods`, and `public.logs`
 * exist so far. Later schema features (F042 weigh_ins, F050 ai_usage, F057
 * conversations, ...) each add their own tables here in their own PR --
 * this file is additive, never replaced wholesale.
 *
 * F017 added `profiles.rules` (a jsonb array, see
 * `supabase/migrations/0003_eating_rules.sql`) -- typed here as
 * `EatingRuleJson[]` rather than the generic `Json` a CLI-generated file
 * would use, since this column's shape is fully controlled by this app (see
 * `src/lib/budget/rules.ts`), matching this file's existing practice of
 * typing `sex`/`activity_level` as narrow unions instead of `string`.
 *
 * F020 added `public.foods` (shared catalog, not user-owned) and
 * `public.logs` (user-owned, own-row RLS) -- see
 * `supabase/migrations/0004_foods_logs.sql`. `foods.common_units` follows
 * the same "typed jsonb array" practice as `profiles.rules` above
 * (`FoodCommonUnit[]` here rather than the generic `Json`).
 *
 * F023 added `public.search_foods(search_query, result_limit)`, a
 * SQL/SECURITY INVOKER RPC function (see
 * `supabase/migrations/0005_food_search.sql`) -- typed under `Functions`
 * below so `supabase.rpc("search_foods", {...})` (see
 * `src/lib/food/search.ts`) gets full argument/return typing instead of
 * `never`.
 */

export type Sex = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

/**
 * The user's overall objective, collected in onboarding and used to drive the
 * budget math (`src/lib/budget/engine.ts`'s `planForGoal`):
 *  - `maintain` / `tone` -> eat at maintenance (TDEE)
 *  - `lose`              -> calorie deficit (target weight below current)
 *  - `gain`             -> calorie surplus (target weight above current)
 */
export type GoalType = "maintain" | "lose" | "gain" | "tone";

/** F017: a single element of `profiles.rules` (jsonb array). See
 * `src/lib/budget/rules.ts`'s `PersistedRule` -- kept as a separate,
 * structurally-identical type here so this file's DB-shape types don't
 * import from `src/lib/budget`. */
export interface EatingRuleJson {
  id: string;
  textSr: string;
  enabled: boolean;
}

/** F020: provenance of a `foods` row. See `supabase/migrations/0004_foods_logs.sql`. */
export type FoodSource = "seed" | "off" | "user";

/** F020: how a `logs` row was created. See `supabase/migrations/0004_foods_logs.sql`. */
export type LogMethod = "search" | "barcode" | "label" | "meal" | "agent";

/** F020: a single element of `foods.common_units` (jsonb array) -- a
 * user-facing portion shortcut, e.g. `{ label: "parce", grams: 50 }`. */
export interface FoodCommonUnit {
  label: string;
  grams: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          phone: string | null;
          sex: Sex | null;
          birth_year: number | null;
          height_cm: number | null;
          weight_kg: number | null;
          activity_level: ActivityLevel | null;
          is_admin: boolean;
          onboarded_at: string | null;
          rules: EatingRuleJson[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string | null;
          phone?: string | null;
          sex?: Sex | null;
          birth_year?: number | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          activity_level?: ActivityLevel | null;
          is_admin?: boolean;
          onboarded_at?: string | null;
          rules?: EatingRuleJson[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          full_name?: string | null;
          phone?: string | null;
          sex?: Sex | null;
          birth_year?: number | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          activity_level?: ActivityLevel | null;
          is_admin?: boolean;
          onboarded_at?: string | null;
          rules?: EatingRuleJson[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      targets: {
        Row: {
          id: string;
          user_id: string;
          daily_kcal: number;
          protein_g: number;
          fat_g: number;
          carbs_g: number;
          weekly_kcal: number;
          goal: GoalType | null;
          goal_weight_kg: number | null;
          timeframe_weeks: number | null;
          effective_from: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          daily_kcal: number;
          protein_g: number;
          fat_g: number;
          carbs_g: number;
          weekly_kcal: number;
          goal?: GoalType | null;
          goal_weight_kg?: number | null;
          timeframe_weeks?: number | null;
          effective_from?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          daily_kcal?: number;
          protein_g?: number;
          fat_g?: number;
          carbs_g?: number;
          weekly_kcal?: number;
          goal?: GoalType | null;
          goal_weight_kg?: number | null;
          timeframe_weeks?: number | null;
          effective_from?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "targets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      foods: {
        Row: {
          id: string;
          name_sr: string;
          brand: string | null;
          kcal_100g: number;
          protein_100g: number;
          carbs_100g: number;
          fat_100g: number;
          common_units: FoodCommonUnit[];
          source: FoodSource;
          verified: boolean;
          is_default: boolean;
          barcode: string | null;
          // 0012: optional reference price in RSD for the whole product/package
          // (NOT per 100 g). Nullable -- most foods have none.
          price: number | null;
          submitted_by: string | null;
          label_photo_path: string | null;
          is_removed: boolean;
          removed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name_sr: string;
          brand?: string | null;
          kcal_100g?: number;
          protein_100g?: number;
          carbs_100g?: number;
          fat_100g?: number;
          common_units?: FoodCommonUnit[];
          source?: FoodSource;
          verified?: boolean;
          is_default?: boolean;
          barcode?: string | null;
          price?: number | null;
          submitted_by?: string | null;
          label_photo_path?: string | null;
          is_removed?: boolean;
          removed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name_sr?: string;
          brand?: string | null;
          kcal_100g?: number;
          protein_100g?: number;
          carbs_100g?: number;
          fat_100g?: number;
          common_units?: FoodCommonUnit[];
          source?: FoodSource;
          verified?: boolean;
          is_default?: boolean;
          barcode?: string | null;
          price?: number | null;
          submitted_by?: string | null;
          label_photo_path?: string | null;
          is_removed?: boolean;
          removed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "foods_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      logs: {
        Row: {
          id: string;
          user_id: string;
          food_id: string | null;
          name: string;
          grams: number;
          kcal: number;
          protein: number;
          carbs: number;
          fat: number;
          logged_at: string;
          method: LogMethod;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          food_id?: string | null;
          name: string;
          grams: number;
          kcal: number;
          protein: number;
          carbs: number;
          fat: number;
          logged_at?: string;
          method: LogMethod;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          food_id?: string | null;
          name?: string;
          grams?: number;
          kcal?: number;
          protein?: number;
          carbs?: number;
          fat?: number;
          logged_at?: string;
          method?: LogMethod;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "logs_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: false;
            referencedRelation: "foods";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      search_foods: {
        Args: {
          search_query: string;
          result_limit?: number;
        };
        Returns: Database["public"]["Tables"]["foods"]["Row"][];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

/** Ergonomic aliases -- most callers want the row shape, not the full `Database` path. */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type Target = Database["public"]["Tables"]["targets"]["Row"];
export type TargetInsert = Database["public"]["Tables"]["targets"]["Insert"];
export type TargetUpdate = Database["public"]["Tables"]["targets"]["Update"];

export type Food = Database["public"]["Tables"]["foods"]["Row"];
export type FoodInsert = Database["public"]["Tables"]["foods"]["Insert"];
export type FoodUpdate = Database["public"]["Tables"]["foods"]["Update"];

export type Log = Database["public"]["Tables"]["logs"]["Row"];
export type LogInsert = Database["public"]["Tables"]["logs"]["Insert"];
export type LogUpdate = Database["public"]["Tables"]["logs"]["Update"];
