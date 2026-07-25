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
 * `public.profiles`, `public.targets`, `public.foods`, `public.logs`, and
 * `public.weigh_ins` (F042, see `supabase/migrations/0012_weigh_ins.sql`)
 * exist so far. Later schema features (F050 ai_usage, F057 conversations,
 * ...) each add their own tables here in their own PR -- this file is
 * additive, never replaced wholesale.
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

/**
 * 0019: one line of a logged meal's itemised breakdown, snapshotted onto
 * `logs.components` at log time. Field names mirror the AI schema
 * (`mealComponentSchema` in `src/lib/ai/meal-estimate.ts`) so the estimate is
 * stored verbatim, without a translation layer that could drift.
 *
 * This is what lets "Dodaj još" offer "+2 jaja" on a meal that was
 * photographed as one plate -- see `src/lib/log/add-more.ts`.
 */
export interface LogComponentSnapshot {
  naziv: string;
  grami: number;
  kcal: number;
  protein_g: number;
  uh_g: number;
  mast_g: number;
  /** Natural single unit of this part and its mass ("jaje"/60, "kašika"/15).
   * Absent / 0 = no natural unit, so one step adds the whole line. */
  kom_naziv?: string;
  kom_grami?: number;
}

/** 0017: where a food's fiber/sugar/sodium/saturated-fat values came from --
 * `'label'` read off a real nutrition declaration, `'ai'` estimated from the
 * name + macros (`src/lib/ai/micro-estimate.ts`), `'manual'` typed by a human. */
export type MicroSource = "label" | "ai" | "manual";

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
          // 0020: the user's own daily step goal. `null`/absent = automatic,
          // i.e. derived from `activity_level` (see src/lib/steps/step-goal.ts).
          // Optional for the same fixture reason as the `logs` micro columns.
          daily_step_goal?: number | null;
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
          daily_step_goal?: number | null;
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
          daily_step_goal?: number | null;
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
          // 0017 micronutrients, per 100 g. `null` = UNKNOWN, which is NOT the
          // same as 0 (see `0017_micronutrients.sql`): an unknown fiber value
          // must never contribute a confident "0 g" to the day's total.
          // Sodium is in MILLIGRAMS, the other three in grams.
          //
          // Typed OPTIONAL (`?`) rather than plain `| null`: `select("*")`
          // always returns all four, but dozens of hand-built `Food` fixtures
          // across the test suite predate this migration, and every reader goes
          // through `src/lib/nutrition/micro.ts` (which normalises
          // `undefined`/`null` to "unknown" identically). Same reasoning for
          // the `logs` columns below.
          fiber_100g?: number | null;
          sugar_100g?: number | null;
          sodium_100g?: number | null;
          sat_fat_100g?: number | null;
          micro_source?: MicroSource | null;
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
          fiber_100g?: number | null;
          sugar_100g?: number | null;
          sodium_100g?: number | null;
          sat_fat_100g?: number | null;
          micro_source?: MicroSource | null;
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
          fiber_100g?: number | null;
          sugar_100g?: number | null;
          sodium_100g?: number | null;
          sat_fat_100g?: number | null;
          micro_source?: MicroSource | null;
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
      weigh_ins: {
        Row: {
          id: string;
          user_id: string;
          /** Belgrade calendar day, `"YYYY-MM-DD"` (a Postgres `date`). */
          day: string;
          weight_kg: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day: string;
          weight_kg: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day?: string;
          weight_kg?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weigh_ins_user_id_fkey";
            columns: ["user_id"];
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
          // 0017 micronutrients, snapshotted for THIS entry (sodium in mg, the
          // rest in grams). `null`/absent = unknown, never 0 -- readers go
          // through `src/lib/nutrition/micro.ts`, which falls back to the
          // referenced food's per-100g value and reports partial coverage.
          // Optional for the same fixture reason as the `foods` columns above.
          fiber?: number | null;
          sugar?: number | null;
          sodium?: number | null;
          sat_fat?: number | null;
          // 0019: itemised breakdown of this entry ("jaja 120 g, tuna 80 g,
          // pavlaka 30 g"), snapshotted at log time by the AI flows. `null`/
          // absent = no breakdown (catalog entry, or logged before 0019) --
          // "Dodaj još" then only offers whole-entry seconds. Optional for the
          // same fixture reason as the micro columns above.
          components?: LogComponentSnapshot[] | null;
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
          fiber?: number | null;
          sugar?: number | null;
          sodium?: number | null;
          sat_fat?: number | null;
          components?: LogComponentSnapshot[] | null;
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
          fiber?: number | null;
          sugar?: number | null;
          sodium?: number | null;
          sat_fat?: number | null;
          components?: LogComponentSnapshot[] | null;
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
      water_intake: {
        Row: {
          id: string;
          user_id: string;
          /** Belgrade calendar day, `"YYYY-MM-DD"` (a Postgres `date`). */
          day: string;
          /** Total water for the day in millilitres (0..20000). */
          ml: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day: string;
          ml?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day?: string;
          ml?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "water_intake_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      step_counts: {
        Row: {
          id: string;
          user_id: string;
          /** Belgrade calendar day, `"YYYY-MM-DD"` (a Postgres `date`). */
          day: string;
          /** Total (manually entered) steps for the day (0..200000). */
          steps: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day: string;
          steps?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day?: string;
          steps?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "step_counts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Podsetnici (0021): one row per DEVICE the user allowed notifications
       * on. Keyed by `endpoint` — re-subscribing the same device updates it. */
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          /** The push service URL for this device (globally unique). */
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_success_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_success_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
          last_success_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Podsetnici (0021): one row per user — which reminders are on, when. */
      reminder_settings: {
        Row: {
          user_id: string;
          no_log_enabled: boolean;
          /** Belgrade wall-clock time, `"HH:MM:SS"` (a Postgres `time`). */
          no_log_time: string;
          /** Belgrade calendar day it last fired (`"YYYY-MM-DD"`), or null. */
          no_log_last_sent: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          no_log_enabled?: boolean;
          no_log_time?: string;
          no_log_last_sent?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          no_log_enabled?: boolean;
          no_log_time?: string;
          no_log_last_sent?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      meal_photos: {
        Row: {
          /** PK + FK to public.logs(id); one photo per log, ON DELETE CASCADE. */
          log_id: string;
          user_id: string;
          /** Small display thumbnail, base64 (no `data:` prefix). */
          image_base64: string;
          mime_type: string;
          created_at: string;
        };
        Insert: {
          log_id: string;
          user_id: string;
          image_base64: string;
          mime_type?: string;
          created_at?: string;
        };
        Update: {
          log_id?: string;
          user_id?: string;
          image_base64?: string;
          mime_type?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_photos_log_id_fkey";
            columns: ["log_id"];
            isOneToOne: true;
            referencedRelation: "logs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_photos_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      habit_checks: {
        Row: {
          id: string;
          user_id: string;
          /** Rule id from the catalog in `src/lib/budget/rules.ts`. */
          habit_id: string;
          /** Belgrade calendar day, `"YYYY-MM-DD"` (a Postgres `date`). */
          day: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          habit_id: string;
          day: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          habit_id?: string;
          day?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_checks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
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

export type WeighIn = Database["public"]["Tables"]["weigh_ins"]["Row"];
export type WeighInInsert = Database["public"]["Tables"]["weigh_ins"]["Insert"];
export type WeighInUpdate = Database["public"]["Tables"]["weigh_ins"]["Update"];

export type MealPhoto = Database["public"]["Tables"]["meal_photos"]["Row"];
export type MealPhotoInsert =
  Database["public"]["Tables"]["meal_photos"]["Insert"];

export type WaterIntake = Database["public"]["Tables"]["water_intake"]["Row"];
export type WaterIntakeInsert =
  Database["public"]["Tables"]["water_intake"]["Insert"];
export type WaterIntakeUpdate =
  Database["public"]["Tables"]["water_intake"]["Update"];

export type HabitCheck = Database["public"]["Tables"]["habit_checks"]["Row"];
export type HabitCheckInsert =
  Database["public"]["Tables"]["habit_checks"]["Insert"];

export type StepCount = Database["public"]["Tables"]["step_counts"]["Row"];
export type StepCountInsert =
  Database["public"]["Tables"]["step_counts"]["Insert"];
export type StepCountUpdate =
  Database["public"]["Tables"]["step_counts"]["Update"];
