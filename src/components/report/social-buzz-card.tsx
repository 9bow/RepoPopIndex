"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/contexts/locale-context";
import type {
  SocialBuzzHN,
  SocialBuzzReddit,
  SocialBuzzStackOverflow,
  SocialBuzzYouTube,
} from "@/lib/types";

interface SocialBuzz {
  hn: SocialBuzzHN | null;
  reddit: SocialBuzzReddit | null;
  stackoverflow: SocialBuzzStackOverflow | null;
  youtube: SocialBuzzYouTube | null;
}

function StatGrid({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      {items.map(({ label, value }) => (
        <div key={label}>
          <p className="text-xl sm:text-2xl font-semibold font-display tabular-nums">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      ))}
    </div>
  );
}

export function SocialBuzzCard({ socialBuzz }: { socialBuzz: SocialBuzz }) {
  const { d } = useLocale();
  const { hn, reddit, stackoverflow, youtube } = socialBuzz;

  return (
    <div className="space-y-4">
      {/* Hacker News */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{d.social.hnTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {hn && hn.storyCount > 0 ? (
            <div className="space-y-3">
              <StatGrid
                items={[
                  { label: d.social.stories, value: hn.storyCount },
                  { label: d.social.points, value: hn.totalPoints },
                  { label: d.social.comments, value: hn.totalComments },
                ]}
              />
              {hn.topStory && (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{d.social.topStory}</p>
                  <a
                    href={hn.topStory.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline underline-offset-2"
                  >
                    {hn.topStory.title}
                  </a>
                  <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                    ({hn.topStory.points} {d.social.pts})
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{d.social.noMentions}</p>
          )}
        </CardContent>
      </Card>

      {/* Reddit */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{d.social.redditTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {reddit && (reddit.post_count ?? 0) > 0 ? (
            <StatGrid
              items={[
                { label: d.social.redditPosts, value: reddit.post_count ?? 0 },
                { label: d.social.redditScore, value: reddit.score_sum ?? 0 },
                { label: d.social.redditComments, value: reddit.comment_sum ?? 0 },
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{d.social.noRedditMentions}</p>
          )}
        </CardContent>
      </Card>

      {/* Stack Overflow */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{d.social.soTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {stackoverflow && (stackoverflow.answer_count ?? 0) > 0 ? (
            <StatGrid
              items={[
                { label: d.social.soQuestions, value: stackoverflow.answer_count ?? 0 },
                { label: d.social.soScore, value: stackoverflow.score_sum ?? 0 },
                { label: d.social.soViews, value: stackoverflow.view_sum ?? 0 },
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{d.social.noSoMentions}</p>
          )}
        </CardContent>
      </Card>

      {/* YouTube */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{d.social.youtubeTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {youtube && (youtube.video_count ?? 0) > 0 ? (
            <StatGrid
              items={[
                { label: d.social.youtubeVideos, value: youtube.video_count ?? 0 },
                { label: d.social.youtubeViews, value: youtube.view_sum ?? 0 },
                { label: d.social.youtubeLikes, value: youtube.like_sum ?? 0 },
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{d.social.noYoutubeMentions}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
