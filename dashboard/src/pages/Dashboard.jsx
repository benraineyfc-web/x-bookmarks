import { useEffect, useState } from "react";
import {
  SimpleGrid,
  Box,
  Text,
  Flex,
  useColorModeValue,
  VStack,
} from "@chakra-ui/react";
import { useOutletContext } from "react-router-dom";
import {
  MdBookmarks,
  MdPerson,
  MdFavorite,
  MdTrendingUp,
} from "react-icons/md";
import Navbar from "../components/navbar/Navbar";
import MiniStat from "../components/stats/MiniStat";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import Card from "../components/card/Card";
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
    }

    loadStats();
  }, []);

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
