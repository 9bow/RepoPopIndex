"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/contexts/locale-context";

interface SocialBuzz {
  hn: {
    storyCount: number;
    totalPoints: number;
    totalComments: number;
    topStory: { title: string; url: string; points: number } | null;
    engagement: number;
  } | null;
}

export function SocialBuzzCard({ socialBuzz }: { socialBuzz: SocialBuzz }) {
  const { d } = useLocale();
  const hn = socialBuzz.hn;

  return (
    <div className="space-y-4">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{d.social.hnTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {hn && hn.storyCount > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl sm:text-2xl font-semibold font-display tabular-nums">{hn.storyCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">{d.social.stories}</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-semibold font-display tabular-nums">
                    {hn.totalPoints.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{d.social.points}</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-semibold font-display tabular-nums">
                    {hn.totalComments.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {d.social.comments}
                  </p>
                </div>
              </div>
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

      <Card className="border-dashed border-border/60 bg-transparent">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground italic">{d.social.comingSoon}</p>
        </CardContent>
      </Card>
    </div>
  );
}
