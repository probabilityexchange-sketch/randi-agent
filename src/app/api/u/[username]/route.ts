import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params;

    try {
        const user = await prisma.user.findUnique({
            where: { username },
            select: {
                id: true,
                username: true,
                walletAddress: true,
                tier: true,
                stakingLevel: true,
                createdAt: true,
                containers: {
                    where: { status: "RUNNING" },
                    select: {
                        id: true,
                        agent: {
                            select: {
                                name: true,
                                slug: true,
                                description: true,
                                image: true,
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        chatSessions: true,
                        tokenTransactions: {
                            where: { status: "CONFIRMED" }
                        }
                    }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Calculate a "Bullish Score" or total contributions
        const transactions = await prisma.tokenTransaction.findMany({
            where: { userId: user.id, status: "CONFIRMED" },
            select: { tokenAmount: true }
        });

        const totalContributed = transactions.reduce((acc, tx) => {
            return acc + (tx.tokenAmount ? Number(tx.tokenAmount) : 0);
        }, 0);

        return NextResponse.json({
            profile: {
                username: user.username,
                walletSnippet: user.walletAddress ? `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}` : null,
                tier: user.tier,
                stakingLevel: user.stakingLevel,
                memberSince: user.createdAt,
                activeAgents: user.containers.length,
                contribution: (totalContributed / 1e6).toFixed(2), // Convert from atomic units
                agents: user.containers.map(c => c.agent),
                stats: {
                    chats: user._count.chatSessions,
                    verified: !!user.walletAddress
                }
            }
        });

    } catch (error) {
        console.error("Failed to fetch public profile:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}
