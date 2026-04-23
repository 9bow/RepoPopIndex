"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const hn = socialBuzz.hn;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Hacker News</CardTitle>
        </CardHeader>
        <CardContent>
          {hn && hn.storyCount > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{hn.storyCount}</p>
                  <p className="text-xs text-muted-foreground">Stories</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {hn.totalPoints.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Points</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {hn.totalComments.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
              </div>
              {hn.topStory && (
                <div className="rounded-lg border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Top Story</p>
                  <a
                    href={hn.topStory.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline"
                  >
                    {hn.topStory.title}
                  </a>
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({hn.topStory.points} pts)
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No Hacker News mentions found for this repository in the selected
              period.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Reddit, Stack Overflow, and YouTube signals coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
