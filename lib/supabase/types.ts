// Hand-written to match supabase/migrations/0001_init_schema.sql.
// If the schema changes, update this file to match (or swap to
// `supabase gen types typescript` once the Supabase CLI is wired up).
//
// `Relationships: never[]` on every table/view satisfies postgrest-js's
// GenericTable/GenericView constraint (it requires the field to exist) —
// omitting it silently collapses the whole schema's inferred types to `never`.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type NotificationType =
  | "created"
  | "finalized"
  | "reminder"
  | "nudge_3d"
  | "nudge_1d"
  | "nudge_today"
  | "voting_closed"
  | "rsvp_3d"
  | "rsvp_1d";

export interface Database {
  public: {
    Tables: {
      groups: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["groups"]["Insert"]>;
        Relationships: never[];
      };
      profiles: {
        Row: {
          id: string;
          group_id: string;
          email: string;
          display_name: string;
          is_owner: boolean;
          avatar_path: string | null;
          password_reset_sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          group_id: string;
          email: string;
          display_name: string;
          is_owner?: boolean;
          avatar_path?: string | null;
          password_reset_sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: never[];
      };
      invites: {
        Row: {
          id: string;
          group_id: string;
          email: string;
          token: string;
          invited_by: string;
          status: "pending" | "accepted" | "revoked";
          created_at: string;
          expires_at: string;
          last_sent_at: string;
          accepted_by: string | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          email: string;
          token: string;
          invited_by: string;
          status?: "pending" | "accepted" | "revoked";
          created_at?: string;
          expires_at?: string;
          last_sent_at?: string;
          accepted_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invites"]["Insert"]>;
        Relationships: never[];
      };
      events: {
        Row: {
          id: string;
          group_id: string;
          organizer_id: string;
          title: string;
          description: string | null;
          location: string | null;
          emoji: string | null;
          image_path: string | null;
          spouses_invited: boolean;
          kids_allowed: boolean;
          status: "polling" | "finalized" | "cancelled";
          finalized_option_id: string | null;
          voting_closes_at: string | null;
          fixed_date: boolean;
          chosen_place_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          organizer_id: string;
          title: string;
          description?: string | null;
          location?: string | null;
          emoji?: string | null;
          image_path?: string | null;
          spouses_invited?: boolean;
          kids_allowed?: boolean;
          status?: "polling" | "finalized" | "cancelled";
          finalized_option_id?: string | null;
          voting_closes_at?: string | null;
          fixed_date?: boolean;
          chosen_place_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: never[];
      };
      event_options: {
        Row: {
          id: string;
          event_id: string;
          starts_at: string;
          ends_at: string | null;
          all_day: boolean;
          label: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          event_id: string;
          starts_at: string;
          ends_at?: string | null;
          all_day?: boolean;
          label?: string | null;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["event_options"]["Insert"]>;
        Relationships: never[];
      };
      votes: {
        Row: {
          id: string;
          event_option_id: string;
          profile_id: string;
          response: "yes" | "maybe" | "no";
          adults_count: number;
          kids_count: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_option_id: string;
          profile_id: string;
          response: "yes" | "maybe" | "no";
          adults_count?: number;
          kids_count?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["votes"]["Insert"]>;
        Relationships: never[];
      };
      event_places: {
        Row: {
          id: string;
          event_id: string;
          url: string;
          title: string | null;
          description: string | null;
          image_url: string | null;
          site_name: string | null;
          added_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          url: string;
          title?: string | null;
          description?: string | null;
          image_url?: string | null;
          site_name?: string | null;
          added_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["event_places"]["Insert"]>;
        Relationships: never[];
      };
      place_votes: {
        Row: {
          place_id: string;
          profile_id: string;
          response: "yes" | "maybe" | "no";
          updated_at: string;
        };
        Insert: {
          place_id: string;
          profile_id: string;
          response: "yes" | "maybe" | "no";
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["place_votes"]["Insert"]>;
        Relationships: never[];
      };
      push_subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
        Relationships: never[];
      };
      notifications_log: {
        Row: {
          id: string;
          event_id: string;
          type: NotificationType;
          sent_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          type: NotificationType;
          sent_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications_log"]["Insert"]>;
        Relationships: never[];
      };
    };
    Views: {
      event_option_tallies: {
        Row: {
          event_option_id: string;
          event_id: string;
          yes_count: number;
          maybe_count: number;
          no_count: number;
          total_attendees: number;
        };
        Relationships: never[];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
