import { startTransition, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  clearAccessToken,
  createDrift,
  fetchSession,
  fetchTimeline,
  getAccessToken,
  loginAccount,
  registerAccount,
  setAccessToken
} from './lib/api';
import { sampleDrifts } from './lib/sampleData';
import type { DriftPublic, PublicUser } from './lib/types';

type AuthMode = 'login' | 'register';

export default function App() {
  const [drifts, setDrifts] = useState<DriftPublic[]>(sampleDrifts);
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [status, setStatus] = useState('漂っている言葉を受け取っています');
  const [postError, setPostError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerHandle, setRegisterHandle] = useState('');
  const [registerDisplayName, setRegisterDisplayName] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [loginValue, setLoginValue] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  async function loadTimeline(viewer: PublicUser | null = currentUser) {
    try {
      const data = await fetchTimeline();

      startTransition(() => {
        setDrifts(data.drifts.length > 0 ? data.drifts : sampleDrifts);
      });

      setStatus(
        data.drifts.length > 0
          ? viewer
            ? `${viewer.display_name} のタイムラインに漂着しました`
            : '公開の漂着を表示しています'
          : 'まだ静かなままです'
      );
    } catch {
      setDrifts(sampleDrifts);
      setStatus('接続できないため、サンプルの言葉を表示しています');
    }
  }

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      const token = getAccessToken();
      let viewer: PublicUser | null = null;

      if (token) {
        try {
          const session = await fetchSession();
          viewer = session.user;

          if (alive) {
            setCurrentUser(session.user);
            setStatus(`${session.user.display_name} として漂っています`);
          }
        } catch {
          clearAccessToken();

          if (alive) {
            setAuthError('保存されていたログイン状態を復元できませんでした。もう一度ログインしてください。');
          }
        }
      } else if (alive) {
        setStatus('公開の漂着を眺めています。流すにはログインしてください');
      }

      if (alive) {
        await loadTimeline(viewer);
        setLoading(false);
      }
    }

    bootstrap();

    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser) {
      setPostError('言葉を流すにはログインが必要です。');
      return;
    }

    const trimmed = body.trim();

    if (!trimmed || posting) {
      return;
    }

    setPosting(true);
    setPostError(null);

    try {
      const result = await createDrift(trimmed);
      const optimistic: DriftPublic = {
        id: result.id,
        author: currentUser,
        body: trimmed,
        resurface_count: 0,
        resonance_count: 0,
        is_resonated: false,
        is_mine: true
      };

      startTransition(() => {
        setDrifts((items) => [optimistic, ...items]);
      });

      setBody('');
      setStatus('言葉が漂い始めます');
    } catch (error) {
      setPostError(error instanceof Error ? error.message : '投稿に失敗しました。');
    } finally {
      setPosting(false);
    }
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthenticating(true);
    setAuthError(null);
    setPostError(null);

    try {
      const session =
        authMode === 'register'
          ? await registerAccount({
              email: registerEmail.trim(),
              handle: registerHandle.trim(),
              display_name: registerDisplayName.trim(),
              password: registerPassword
            })
          : await loginAccount({
              login: loginValue.trim(),
              password: loginPassword
            });

      setAccessToken(session.token);
      setCurrentUser(session.user);
      setStatus(`${session.user.display_name} として漂っています`);
      setRegisterPassword('');
      setLoginPassword('');
      await loadTimeline(session.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '認証に失敗しました。');
    } finally {
      setAuthenticating(false);
    }
  }

  function handleLogout() {
    clearAccessToken();
    setCurrentUser(null);
    setPostError(null);
    setAuthError(null);
    setStatus('ログアウトしました。公開の漂着を表示しています');
    void loadTimeline(null);
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.18),_transparent_40%),radial-gradient(circle_at_20%_20%,_rgba(167,139,250,0.12),_transparent_25%),radial-gradient(circle_at_80%_0%,_rgba(255,255,255,0.07),_transparent_20%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />

        <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs uppercase tracking-[0.4em] text-mist/70">TimixedDiary</p>
              <h1 className="font-display text-4xl font-light tracking-[0.08em] text-white sm:text-5xl">
                日付のない日記SNS
              </h1>
              <p className="max-w-xl text-sm leading-7 text-mist sm:text-base">
                書いた瞬間は見せず、言葉だけを漂わせる。流れてきた投稿に、時刻は残しません。
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist">
              <div className="mb-1 text-xs uppercase tracking-[0.3em] text-white/50">status</div>
              <div>{status}</div>
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-soft backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-sm uppercase tracking-[0.35em] text-mist/70">流す</h2>
                <span className="text-xs text-mist/50">{loading ? 'loading' : `${drifts.length} items`}</span>
              </div>

              <form className="space-y-3" onSubmit={handleSubmit}>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={currentUser ? '今の気配を、ここに置く' : 'ログインするとここに言葉を流せます'}
                  rows={5}
                  disabled={!currentUser}
                  className="w-full rounded-[22px] border border-white/10 bg-black/30 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-white/30 focus:border-glow/60 focus:ring-2 focus:ring-glow/20 disabled:opacity-60"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-6 text-mist/60">
                    投稿日時は表示しません。{currentUser ? '言葉だけが、あとから浮かびます。' : 'まずは公開の漂着を眺められます。'}
                  </p>
                  <button
                    type="submit"
                    disabled={posting || body.trim().length === 0 || !currentUser}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-ember to-glow px-6 py-3 text-sm font-medium text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {posting ? '漂わせ中...' : '流す'}
                  </button>
                </div>
                {postError ? (
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-6 text-mist/80">
                    {postError}
                  </p>
                ) : null}
              </form>
            </div>

            <div className="space-y-4">
              <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(167,139,250,0.12),rgba(255,255,255,0.03))] p-5 shadow-soft backdrop-blur">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm uppercase tracking-[0.35em] text-mist/70">account</h2>
                  {currentUser ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] tracking-[0.2em] text-white/70 transition hover:bg-white/10"
                    >
                      logout
                    </button>
                  ) : (
                    <div className="flex rounded-full border border-white/10 bg-black/20 p-1 text-[11px] tracking-[0.2em] text-white/55">
                      <button
                        type="button"
                        onClick={() => setAuthMode('login')}
                        className={`rounded-full px-3 py-1 transition ${authMode === 'login' ? 'bg-white/10 text-white' : ''}`}
                      >
                        login
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode('register')}
                        className={`rounded-full px-3 py-1 transition ${authMode === 'register' ? 'bg-white/10 text-white' : ''}`}
                      >
                        register
                      </button>
                    </div>
                  )}
                </div>

                {currentUser ? (
                  <div className="mt-4 space-y-3 text-sm text-mist">
                    <p className="text-white/90">{currentUser.display_name}</p>
                    <p>@{currentUser.handle}</p>
                    <p className="text-xs leading-6 text-mist/60">
                      ログイン中は、自分の投稿がタイムライン上で「— わたし」として識別されます。
                    </p>
                  </div>
                ) : (
                  <form className="mt-4 space-y-3" onSubmit={handleAuthSubmit}>
                    {authMode === 'register' ? (
                      <>
                        <input
                          value={registerEmail}
                          onChange={(event) => setRegisterEmail(event.target.value)}
                          placeholder="email"
                          type="email"
                          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                        />
                        <input
                          value={registerHandle}
                          onChange={(event) => setRegisterHandle(event.target.value)}
                          placeholder="handle"
                          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                        />
                        <input
                          value={registerDisplayName}
                          onChange={(event) => setRegisterDisplayName(event.target.value)}
                          placeholder="display name"
                          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                        />
                        <input
                          value={registerPassword}
                          onChange={(event) => setRegisterPassword(event.target.value)}
                          placeholder="password"
                          type="password"
                          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                        />
                      </>
                    ) : (
                      <>
                        <input
                          value={loginValue}
                          onChange={(event) => setLoginValue(event.target.value)}
                          placeholder="email or handle"
                          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                        />
                        <input
                          value={loginPassword}
                          onChange={(event) => setLoginPassword(event.target.value)}
                          placeholder="password"
                          type="password"
                          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                        />
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={authenticating}
                      className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/10 px-5 py-2.5 text-sm text-white transition hover:bg-white/15 disabled:opacity-40"
                    >
                      {authenticating ? 'connecting...' : authMode === 'register' ? '登録する' : 'ログイン'}
                    </button>

                    {authError ? (
                      <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-6 text-mist/80">
                        {authError}
                      </p>
                    ) : null}
                  </form>
                )}
              </aside>

              <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(167,139,250,0.12),rgba(255,255,255,0.03))] p-5 shadow-soft backdrop-blur">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm uppercase tracking-[0.35em] text-mist/70">約束</h2>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] tracking-[0.25em] text-white/60">
                    no timestamps
                  </span>
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-mist">
                  <li>
                    ・<code className="text-white/75">composed_at</code> と{' '}
                    <code className="text-white/75">surface_at</code> は画面に出しません。
                  </li>
                  <li>・自分の投稿には「— わたし」を添えます。</li>
                  <li>・再浮上した投稿は控えめなバッジで示します。</li>
                  <li>・時系列ではなく、漂着として見せます。</li>
                </ul>
              </aside>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <h2 className="text-sm uppercase tracking-[0.35em] text-mist/70">timeline</h2>
              <p className="text-xs text-mist/50">
                {currentUser ? 'ログイン後のホームを表示しています' : '未ログイン時は公開の漂着を表示します'}
              </p>
            </div>

            <div className="grid gap-4">
              {drifts.map((drift, index) => (
                <article
                  key={drift.id}
                  className="animate-rise rounded-[24px] border border-white/10 bg-white/[0.05] p-5 shadow-soft backdrop-blur"
                  style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-mist/70">
                    <span className="font-medium text-white/85">{drift.author.display_name}</span>
                    <span>@{drift.author.handle}</span>
                    {drift.is_mine ? (
                      <span className="rounded-full border border-glow/40 bg-glow/10 px-2.5 py-1 text-[10px] tracking-[0.25em] text-glow">
                        — わたし
                      </span>
                    ) : null}
                    {drift.resurface_count > 0 ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] tracking-[0.18em] text-white/55">
                        また流れてきた
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-white/92">{drift.body}</p>

                  <div className="mt-4 flex items-center gap-4 text-xs text-mist/55">
                    <span>{drift.resonance_count} resonance</span>
                    {drift.is_resonated ? <span className="text-glow/90">you resonated</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
