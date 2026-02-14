import { Logger } from '@nestjs/common';
import { Suspense } from 'react';
import { Await } from 'react-router';

import { Welcome } from '~app/welcome/welcome';
import type { Route } from './+types/home';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'New React Router App' }, { name: 'description', content: 'Welcome to React Router!' }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const githubStatusProvider = context.githubStatusProvider();
  const telemetryProvider = context.telemetryProvider();

  Logger.log('Loading GitHub status summary in Home loader', 'home.tsx');

  telemetryProvider.count('home_loader_calls', {
    description: 'Number of times the home loader was called',
  });

  const summary = telemetryProvider.withSpan('getGitHubStatusSummary', async () => githubStatusProvider.getSummary());

  return { summary };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Welcome />
      <Suspense fallback={<p>Loading GitHub status…</p>}>
        <Await resolve={loaderData.summary}>{(summary) => <pre>{JSON.stringify(summary, null, 2)}</pre>}</Await>
      </Suspense>
    </>
  );
}
