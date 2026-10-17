"use client";

/**
 * StudentsTab — the "Students" half of Messages: find a classmate and start a chat.
 *
 *  - One search box (name, course or subject) plus quick filters: Online now, Same course as me, and the most common courses.
 *  - Classmates aiming for the same course come first, then students who share your subjects, then people who are online.
 *  - Every row has a green dot when the student is online, a large Message button, and opens the profile when tapped.
 *  - Shown 24 at a time. Names beyond the first batch are still found: typing 2+ letters also asks the server.
 *
 * The ordering, filtering and paging rules live in lib/studentDirectory.ts (unit-tested).
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, Loader2, MessageCircle, RotateCw, Search, SearchX, Users, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Avatar from "@/components/Avatar";
import OnlineDot, { useOnlineUsers } from "@/components/OnlineDot";
import {
  courseChips, escapeLike, filterStudents, isFiltering, mergeStudents, NO_FILTER, norm, PAGE_SIZE, pageOf, rankStudents,
  REMOTE_SEARCH_LIMIT, sameCourse, sharedSubjects, wantsRemoteSearch, withoutHidden, type Student, type StudentFilter,
} from "@/lib/studentDirectory";

const STUDENT_COLUMNS = "id, full_name, avatar_url, course, interests, streak_days";
// How long the order stays put after someone comes online or goes offline, so rows don't jump under a thumb
const REORDER_DELAY_MS = 20_000;

type Props = {
  myId: string;
  me: Student | null;
  /** Students already loaded for the directory (without me or anyone I blocked). */
  directory: Student[];
  blocked: ReadonlySet<string>;
  loading: boolean;
  loadError: boolean;
  onRetry: () => void;
};

function chipClass(active: boolean) {
  return `inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-bold transition ${
    active ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700"
  }`;
}

function Row({ s, me, online }: { s: Student; me: Student | null; online: boolean }) {
  const classmate = sameCourse(me?.course, s.course);
  const shared = sharedSubjects(me, s);
  const sharedKeys = new Set(shared.map(norm));
  const subjects = [...shared, ...(s.interests ?? []).filter((i) => !sharedKeys.has(norm(i)))];
  const shownSubjects = subjects.slice(0, 2);
  const extra = subjects.length - shownSubjects.length;
  const streak = typeof s.streak_days === "number" && s.streak_days > 0 ? s.streak_days : 0;

  return (
    <li className="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200 transition hover:ring-violet-300">
      <Link href={`/profile/${s.id}`} className="relative shrink-0" aria-label={`View ${s.full_name}'s profile`}>
        <Avatar user={s} size="lg" />
        {online && <OnlineDot userId={s.id} size={44} />}
      </Link>

      <Link href={`/profile/${s.id}`} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-900">{s.full_name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          {s.course ? <span className="truncate font-semibold">{s.course}</span> : <span className="truncate text-slate-400">No course yet</span>}
          {online && <span className="shrink-0 font-bold text-emerald-600">· Active now</span>}
        </span>
        {(classmate || streak > 0 || shownSubjects.length > 0) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-1">
            {classmate && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700">Same course</span>
            )}
            {streak > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                <Flame className="h-3 w-3" aria-hidden /> {streak}d
              </span>
            )}
            {shownSubjects.map((i) => (
              <span
                key={i}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sharedKeys.has(norm(i)) ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"}`}
              >
                {i.replace(" Language", "")}
              </span>
            ))}
            {extra > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">+{extra}</span>}
          </span>
        )}
      </Link>

      <Link
        href={`/messages/${s.id}`}
        aria-label={`Message ${s.full_name}`}
        className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-violet-600 text-white transition hover:bg-violet-700 sm:px-4"
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
        <span className="hidden text-xs font-black sm:inline">Message</span>
      </Link>
    </li>
  );
}

export default function StudentsTab({ myId, me, directory, blocked, loading, loadError, onRetry }: Props) {
  const online = useOnlineUsers();
  const [filter, setFilter] = useState<StudentFilter>(NO_FILTER);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [remote, setRemote] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);

  // The order uses a slightly delayed copy of "who is online" so it stays put while you scroll and tap
  const [rankOnline, setRankOnline] = useState<ReadonlySet<string>>(online);
  const onlineNow = useRef(online);
  useEffect(() => { onlineNow.current = online; }, [online]);
  useEffect(() => {
    const id = window.setInterval(() => setRankOnline(onlineNow.current), REORDER_DELAY_MS);
    return () => window.clearInterval(id);
  }, []);
  // The very first batch of presence data is applied straight away
  useEffect(() => {
    if (rankOnline.size > 0 || online.size === 0) return;
    const t = window.setTimeout(() => setRankOnline(online), 0);
    return () => window.clearTimeout(t);
  }, [online, rankOnline.size]);

  function update(patch: Partial<StudentFilter>) {
    setFilter((f) => ({ ...f, ...patch }));
    setVisible(PAGE_SIZE);
  }
  const clearAll = () => { setFilter(NO_FILTER); setVisible(PAGE_SIZE); };

  // Typing 2+ letters also asks the server, so students outside the first batch can still be found by name
  useEffect(() => {
    const q = filter.query.trim();
    if (!wantsRemoteSearch(q)) return;
    let live = true;
    const t = window.setTimeout(() => {
      setSearching(true);
      createSupabaseBrowserClient()
        .from("profiles")
        .select(STUDENT_COLUMNS)
        .ilike("full_name", `%${escapeLike(q)}%`)
        .neq("id", myId)
        .limit(REMOTE_SEARCH_LIMIT)
        .then(
          ({ data }) => { if (live) { setRemote((data ?? []) as Student[]); setSearching(false); } },
          () => { if (live) setSearching(false); },
        );
    }, 300);
    return () => { live = false; window.clearTimeout(t); };
  }, [filter.query, myId]);

  const pool = useMemo(
    () => withoutHidden(wantsRemoteSearch(filter.query) ? mergeStudents(directory, remote) : directory, myId, blocked),
    [directory, remote, filter.query, myId, blocked],
  );
  const ranked = useMemo(() => rankStudents(pool, me, rankOnline), [pool, me, rankOnline]);
  const matches = useMemo(() => filterStudents(ranked, filter, me, online), [ranked, filter, me, online]);
  const { shown, remaining } = pageOf(matches, visible);

  const chips = useMemo(() => courseChips(directory), [directory]);
  const onlineCount = useMemo(() => directory.reduce((n, s) => n + (online.has(s.id) ? 1 : 0), 0), [directory, online]);
  const filtering = isFiltering(filter);
  const pickedCourse = norm(filter.course);
  const myCourseKnown = norm(me?.course).length >= 2;
  const showSpinner = searching && wantsRemoteSearch(filter.query);

  return (
    <section aria-label="Students">
      {/* ── Search ── */}
      {!loadError && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search students"
            placeholder="Name, course or subject"
            value={filter.query}
            onChange={(e) => update({ query: e.target.value })}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          />
          <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
            {showSpinner ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Searching" />
            ) : filter.query ? (
              <button type="button" onClick={() => update({ query: "" })} aria-label="Clear search" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </span>
        </div>
      )}

      {/* ── Quick filters (scroll sideways on a small phone) ── */}
      {!loading && !loadError && directory.length > 0 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filters">
          <button type="button" aria-pressed={filter.online} onClick={() => update({ online: !filter.online })} className={chipClass(filter.online)}>
            <span className={`h-2 w-2 rounded-full ${filter.online ? "bg-white" : "bg-emerald-500"}`} aria-hidden />
            Online now{onlineCount > 0 && <span className={filter.online ? "text-violet-100" : "text-slate-400"}>{onlineCount}</span>}
          </button>
          {myCourseKnown && (
            <button type="button" aria-pressed={filter.sameCourse} onClick={() => update({ sameCourse: !filter.sameCourse })} className={chipClass(filter.sameCourse)}>
              Same course as me
            </button>
          )}
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={pickedCourse === c.key}
              onClick={() => update({ course: pickedCourse === c.key ? "" : c.label })}
              className={chipClass(pickedCourse === c.key)}
            >
              <span className="max-w-[12rem] truncate">{c.label}</span>
              <span className={pickedCourse === c.key ? "text-violet-100" : "text-slate-400"}>{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Result line ── */}
      {!loading && !loadError && directory.length > 0 && (
        <div className="mb-3 mt-3 flex min-h-6 items-center justify-between gap-3 text-xs text-slate-500" aria-live="polite">
          <p>
            {filtering
              ? <><span className="font-bold text-slate-700">{matches.length}</span> {matches.length === 1 ? "student" : "students"} found</>
              : <><span className="font-bold text-slate-700">{directory.length}</span> {directory.length === 1 ? "student" : "students"}{myCourseKnown ? " · classmates first" : ""}</>}
          </p>
          {filtering && matches.length > 0 && <button type="button" onClick={clearAll} className="font-bold text-violet-600 hover:underline">Clear filters</button>}
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <ul className="mt-4 space-y-2" aria-busy="true" aria-label="Loading students">
          {[0, 1, 2, 3, 4].map((n) => (
            <li key={n} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
              <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-slate-100" />
              <span className="min-w-0 flex-1 space-y-2">
                <span className="block h-3.5 w-2/5 animate-pulse rounded bg-slate-100" />
                <span className="block h-3 w-3/5 animate-pulse rounded bg-slate-100" />
              </span>
              <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-slate-100" />
            </li>
          ))}
        </ul>
      ) : loadError ? (
        <div className="mt-4 rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200">
          <SearchX className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
          <p className="mt-2 text-base font-black text-slate-900">Couldn&apos;t load students</p>
          <p className="mt-1 text-sm text-slate-500">Check your connection and try again.</p>
          <button type="button" onClick={onRetry} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-violet-600 px-5 text-sm font-bold text-white hover:bg-violet-700">
            <RotateCw className="h-4 w-4" aria-hidden /> Try again
          </button>
        </div>
      ) : directory.length === 0 && !filtering ? (
        <div className="mt-4 rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200">
          <Users className="mx-auto h-8 w-8 text-violet-400" aria-hidden />
          <p className="mt-2 text-base font-black text-slate-900">No other students yet</p>
          <p className="mt-1 text-sm text-slate-500">Students who join Qubit Learn will show up here.</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200">
          <SearchX className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
          <p className="mt-2 text-base font-black text-slate-900">
            {filter.online && !filter.query.trim() && !filter.sameCourse && !pickedCourse ? "Nobody is online right now" : "No students found"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {filter.online && !filter.query.trim() && !filter.sameCourse && !pickedCourse
              ? "Check back soon, or message someone and they will see it when they open the app."
              : "Try a different name, course or subject."}
          </p>
          <button type="button" onClick={clearAll} className="mt-4 inline-flex h-11 items-center rounded-full bg-violet-600 px-5 text-sm font-bold text-white hover:bg-violet-700">
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {shown.map((s) => <Row key={s.id} s={s} me={me} online={online.has(s.id)} />)}
          </ul>
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mx-auto mt-4 flex h-11 items-center rounded-full border border-slate-200 bg-white px-6 text-sm font-bold text-violet-700 hover:border-violet-300"
            >
              Show more ({remaining} left)
            </button>
          )}
        </>
      )}
    </section>
  );
}
