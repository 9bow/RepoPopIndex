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
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{d.social.hnTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {hn && hn.storyCount > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{hn.storyCount}</p>
                  <p className="text-xs text-muted-foreground">{d.social.stories}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {hn.totalPoints.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{d.social.points}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {hn.totalComments.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.social.comments}
                  </p>
                </div>
              </div>
              {hn.topStory && (
                <div className="rounded-lg border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{d.social.topStory}</p>
                  <a
                    href={hn.topStory.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline"
                  >
                    {hn.topStory.title}
                  </a>
                  <span className="ml-2 text-xs text-muted-foreground">
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

      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">{d.social.comingSoon}</p>
        </CardContent>
      </Card>
    </div>
  );
}
