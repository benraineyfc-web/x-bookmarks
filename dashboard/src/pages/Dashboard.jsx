import { useEffect, useState } from "react";
import {
  SimpleGrid,
  Box,
  Text,
  Flex,
  useColorModeValue,
  VStack,
  Button,
  Progress,
  useToast,
} from "@chakra-ui/react";
import { useOutletContext } from "react-router-dom";
import {
  MdBookmarks,
  MdPerson,
  MdFavorite,
  MdTrendingUp,
  MdCloudDownload,
} from "react-icons/md";
import Navbar from "../components/navbar/Navbar";
import MiniStat from "../components/stats/MiniStat";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import Card from "../components/card/Card";
import TrendChart from "../components/stats/TrendChart";
import { db } from "../lib/db";

export default function Dashboard() {
  const { onOpenSidebar } = useOutletContext();
  const [stats, setStats] = useState({
    total: 0,
    authors: 0,
    totalLikes: 0,
    thisWeek: 0,
  });
  const [recent, setRecent] = useState([]);
  const [topAuthors, setTopAuthors] = useState([]);
  const [weeklyTrend, setWeeklyTrend] = useState([]);
  const [engagementData, setEngagementData] = useState([]);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState(null);
  const toast = useToast();
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const subColor = useColorModeValue("secondaryGray.600", "secondaryGray.600");

  useEffect(() => {
    async function loadStats() {
      const all = await db.bookmarks.toArray();
      const authors = new Map();
      let totalLikes = 0;

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      let thisWeek = 0;

      for (const bm of all) {
        totalLikes += bm.likes || 0;
        const a = bm.author_username;
        if (a) {
          authors.set(a, (authors.get(a) || 0) + 1);
        }
        if (bm.importedAt && new Date(bm.importedAt) > oneWeekAgo) {
          thisWeek++;
        }
      }

      setStats({
        total: all.length,
        authors: authors.size,
        totalLikes,
        thisWeek,
      });

      // Recent bookmarks (by import date)
      const sorted = [...all].sort(
        (a, b) =>
          new Date(b.importedAt || 0) - new Date(a.importedAt || 0)
      );
      setRecent(sorted.slice(0, 6));

      // Top authors
      const authorList = [...authors.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));
      setTopAuthors(authorList);

      // Weekly trend (last 8 weeks)
      const weeks = [];
      for (let w = 7; w >= 0; w--) {
        const start = new Date();
        start.setDate(start.getDate() - w * 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        const count = all.filter((bm) => {
          const d = new Date(bm.importedAt || bm.created_at || 0);
          return d >= start && d < end;
        }).length;
        const label = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        weeks.push({ label, value: count });
      }
      setWeeklyTrend(weeks);

      // Engagement breakdown (avg likes by top 5 authors)
      const authorEngagement = [...authors.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name]) => {
          const authorBms = all.filter((bm) => bm.author_username === name);
          const avgLikes = Math.round(
            authorBms.reduce((s, bm) => s + (bm.likes || 0), 0) / authorBms.length
          );
          return { label: `@${name.slice(0, 8)}`, value: avgLikes };
        });
      setEngagementData(authorEngagement);
    }

    loadStats();
  }, []);

  const handleScrapeAll = async () => {
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await fetch("/api/bookmarks/scrape-batch?limit=10", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Scrape request failed");
      const data = await res.json();
      setScrapeResult(data);
      toast({
        title: `Scraped ${data.scraped || 0} bookmarks`,
        description: data.errors ? `${data.errors} errors` : "All done",
        status: data.scraped > 0 ? "success" : "info",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
    } catch (e) {
      toast({
        title: "Scrape failed",
        description: e.message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
    }
    setScraping(false);
  };

  return (
    <Box>
      <Navbar onOpen={onOpenSidebar} title="Dashboard" />

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="20px" mb="20px">
        <MiniStat
          name="Total Bookmarks"
          value={stats.total.toLocaleString()}
          icon={MdBookmarks}
          iconBg="linear-gradient(135deg, #868CFF 0%, #4318FF 100%)"
        />
        <MiniStat
          name="Unique Authors"
          value={stats.authors.toLocaleString()}
          icon={MdPerson}
          iconBg="linear-gradient(135deg, #66E6AC 0%, #01B574 100%)"
        />
        <MiniStat
          name="Total Likes"
          value={
            stats.totalLikes >= 1000000
              ? (stats.totalLikes / 1000000).toFixed(1) + "M"
              : stats.totalLikes >= 1000
              ? (stats.totalLikes / 1000).toFixed(1) + "K"
              : stats.totalLikes.toLocaleString()
          }
          icon={MdFavorite}
          iconBg="linear-gradient(135deg, #FF6B6B 0%, #EE5D50 100%)"
        />
        <MiniStat
          name="Added This Week"
          value={stats.thisWeek.toLocaleString()}
          icon={MdTrendingUp}
          iconBg="linear-gradient(135deg, #FFB547 0%, #FF9B05 100%)"
        />
      </SimpleGrid>

      {/* Scrape All */}
      <Card mb="20px" p="16px 20px">
        <Flex align="center" justify="space-between" wrap="wrap" gap="12px">
          <Box>
            <Text fontSize="sm" fontWeight="700" color={textColor}>
              Batch Scrape
            </Text>
            <Text fontSize="xs" color={subColor}>
              Scrape linked articles for up to 10 un-scraped bookmarks at a time
            </Text>
          </Box>
          <Button
            size="sm"
            leftIcon={<MdCloudDownload />}
            colorScheme="brand"
            variant="solid"
            borderRadius="12px"
            isLoading={scraping}
            loadingText="Scraping..."
            onClick={handleScrapeAll}
          >
            Scrape All
          </Button>
        </Flex>
        {scraping && <Progress size="xs" isIndeterminate mt="12px" borderRadius="full" colorScheme="brand" />}
        {scrapeResult && (
          <Text fontSize="xs" color="green.400" mt="8px">
            {scrapeResult.scraped || 0} scraped, {scrapeResult.errors || 0} errors, {scrapeResult.skipped || 0} skipped
          </Text>
        )}
      </Card>

      {/* Analytics charts */}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="20px" mb="20px">
        <Card>
          <TrendChart data={weeklyTrend} title="Bookmarks Added (Last 8 Weeks)" color="#7551FF" />
        </Card>
        <Card>
          <TrendChart data={engagementData} title="Avg Likes by Top Authors" color="#01B574" />
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px">
        <Box gridColumn={{ xl: "span 2" }}>
          <Text fontSize="lg" fontWeight="700" color={textColor} mb="16px">
            Recently Added
          </Text>
          {recent.length === 0 ? (
            <Card>
              <Text color={subColor} textAlign="center" py="40px">
                No bookmarks yet. Go to Import to add your first batch.
              </Text>
            </Card>
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="16px">
              {recent.map((bm) => (
                <BookmarkCard key={bm.id} bookmark={bm} />
              ))}
            </SimpleGrid>
          )}
        </Box>

        <Box>
          <Text fontSize="lg" fontWeight="700" color={textColor} mb="16px">
            Top Authors
          </Text>
          <Card>
            {topAuthors.length === 0 ? (
              <Text color={subColor} textAlign="center" py="20px">
                No data yet
              </Text>
            ) : (
              <VStack spacing="12px" align="stretch">
                {topAuthors.map((author, i) => (
                  <Flex key={author.name} justify="space-between" align="center">
                    <Flex align="center" gap="8px">
                      <Text
                        fontSize="xs"
                        fontWeight="700"
                        color={subColor}
                        w="20px"
                      >
                        {i + 1}
                      </Text>
                      <Text fontSize="sm" fontWeight="600" color={textColor}>
                        @{author.name}
                      </Text>
                    </Flex>
                    <Text fontSize="sm" fontWeight="700" color="brand.400">
                      {author.count}
                    </Text>
                  </Flex>
                ))}
              </VStack>
            )}
          </Card>
        </Box>
      </SimpleGrid>
    </Box>
  );
}
