-- NEXORA chat realtime + performance tuning for Supabase SQL Editor.
-- Safe to run more than once. It creates missing chat columns/indexes and
-- ensures the tables used by client realtime listeners are in the publication.

create table if not exists public.dm_room (
  roomid text primary key,
  usera text not null,
  userb text not null,
  useraname text,
  useraimage text,
  userbname text,
  userbimage text,
  updatedat timestamptz not null default now()
);

do $$
begin
  if to_regclass('public."dmMessage"') is not null then
    execute 'alter table public."dmMessage" add column if not exists "imageUrl" text';
    execute 'alter table public."dmMessage" add column if not exists "senderName" text';
    execute 'alter table public."dmMessage" add column if not exists "senderImage" text';
    execute 'alter table public."dmMessage" add column if not exists "seenAt" timestamptz';
    execute 'alter table public."dmMessage" replica identity full';

    execute 'create index if not exists "dmMessage_roomId_createdAt_desc_idx" on public."dmMessage" ("roomId", "createdAt" desc)';
    execute 'create index if not exists "dmMessage_roomId_seenAt_senderId_idx" on public."dmMessage" ("roomId", "seenAt", "senderId")';
    execute 'create index if not exists "dmMessage_unread_room_createdAt_idx" on public."dmMessage" ("roomId", "createdAt" desc) where "seenAt" is null';
    execute 'create index if not exists "dmMessage_senderId_createdAt_idx" on public."dmMessage" ("senderId", "createdAt" desc)';
  end if;

  if to_regclass('public.dm_room') is not null then
    execute 'alter table public.dm_room replica identity full';
    execute 'create index if not exists "dm_room_usera_updatedat_idx" on public.dm_room (usera, updatedat desc)';
    execute 'create index if not exists "dm_room_userb_updatedat_idx" on public.dm_room (userb, updatedat desc)';
    execute 'create index if not exists "dm_room_pair_idx" on public.dm_room (usera, userb)';
  end if;

  if to_regclass('public."AppNotification"') is not null then
    execute 'create index if not exists "AppNotification_user_read_created_idx" on public."AppNotification" ("userId", "readAt", "createdAt" desc)';
  end if;

  if to_regclass('public."FriendRequest"') is not null then
    execute 'create index if not exists "FriendRequest_to_status_created_idx" on public."FriendRequest" ("toUserId", "status", "createdAt" desc)';
    execute 'create index if not exists "FriendRequest_from_to_status_idx" on public."FriendRequest" ("fromUserId", "toUserId", "status")';
  end if;

  if to_regclass('public."DealRequest"') is not null then
    execute 'create index if not exists "DealRequest_participant_status_idx" on public."DealRequest" ("status", "buyerId", "sellerId")';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if to_regclass('public."dmMessage"') is not null then
      begin
        alter publication supabase_realtime add table public."dmMessage";
      exception when duplicate_object then
        null;
      end;
    end if;

    if to_regclass('public.dm_room') is not null then
      begin
        alter publication supabase_realtime add table public.dm_room;
      exception when duplicate_object then
        null;
      end;
    end if;

    if to_regclass('public."AppNotification"') is not null then
      begin
        alter publication supabase_realtime add table public."AppNotification";
      exception when duplicate_object then
        null;
      end;
    end if;

    if to_regclass('public."FriendRequest"') is not null then
      begin
        alter publication supabase_realtime add table public."FriendRequest";
      exception when duplicate_object then
        null;
      end;
    end if;

    if to_regclass('public."DealRequest"') is not null then
      begin
        alter publication supabase_realtime add table public."DealRequest";
      exception when duplicate_object then
        null;
      end;
    end if;

    if to_regclass('public."dmRoomClearState"') is not null then
      begin
        alter publication supabase_realtime add table public."dmRoomClearState";
      exception when duplicate_object then
        null;
      end;
    end if;

    if to_regclass('public."dmConversationClearState"') is not null then
      begin
        alter publication supabase_realtime add table public."dmConversationClearState";
      exception when duplicate_object then
        null;
      end;
    end if;
  end if;
end $$;
