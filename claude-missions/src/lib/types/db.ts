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
 * Only `public.profiles` and `public.targets` exist so far. Later schema
 * features (F020 foods, F025 logs, F042 weigh_ins, F050 ai_usage, F057
 * conversations, ...) each add their own tables here in their own PR --
 * this file is additive, never replaced wholesale.
 *
 * F017 added `profiles.rules` (a jsonb array, see
 * `supabase/migrations/0003_eating_rules.sql`) -- typed here as
 * `EatingRuleJson[]` rather than the generic `Json` a CLI-generated file
 * would use, since this column's shape is fully controlled by this app (see
 * `src/lib/budget/rules.ts`), matching this file's existing practice of
 * typing `sex`/`activity_level` as narrow unions instead of `string`.
 */

export type Sex = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

/** F017: a single element of `profiles.rules` (jsonb array). See
 * `src/lib/budget/rules.ts`'s `PersistedRule` -- kept as a separate,
 * structurally-identical type here so this file's DB-shape types don't
 * import from `src/lib/budget`. */
export interface EatingRuleJson {
  id: string;
  textSr: string;
  enabled: boolean;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
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
          goal_weight_kg: number;
          timeframe_weeks: number;
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
          goal_weight_kg: number;
          timeframe_weeks: number;
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
          goal_weight_kg?: number;
          timeframe_weeks?: number;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
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
