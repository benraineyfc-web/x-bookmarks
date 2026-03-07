import {
  Box,
  Flex,
  Text,
  Tag,
  TagLabel,
  HStack,
  IconButton,
  useColorModeValue,
  Tooltip,
  Link,
} from "@chakra-ui/react";
import { MdOpenInNew, MdBookmarkAdd, MdFavorite, MdRepeat, MdVisibility } from "react-icons/md";
import Card from "../card/Card";

function formatNumber(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function BookmarkCard({ bookmark, onSelect, isSelected, onTagClick }) {
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const subColor = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const borderColor = useColorModeValue("gray.200", "whiteAlpha.100");
  const selectedBorder = useColorModeValue("brand.500", "brand.400");

  return (
    <Card
      border="2px solid"
      borderColor={isSelected ? selectedBorder : "transparent"}
      cursor="pointer"
      onClick={() => onSelect && onSelect(bookmark)}
      _hover={{
        borderColor: isSelected ? selectedBorder : borderColor,
        transform: "translateY(-1px)",
      }}
      transition="all 0.15s"
    >
      <Flex justify="space-between" align="flex-start" mb="8px">
        <Box>
          <Text fontSize="sm" fontWeight="700" color={textColor}>
            @{bookmark.author_username}
          </Text>
          {bookmark.author_name && (
            <Text fontSize="xs" color={subColor}>
              {bookmark.author_name}
            </Text>
          )}
        </Box>
        <Flex gap="4px" align="center">
          <Text fontSize="xs" color={subColor}>
            {formatDate(bookmark.created_at)}
          </Text>
          <Tooltip label="Open on X">
            <IconButton
              as={Link}
              href={bookmark.url}
              isExternal
              icon={<MdOpenInNew />}
              size="xs"
              variant="ghost"
              color={subColor}
              aria-label="Open on X"
              onClick={(e) => e.stopPropagation()}
            />
          </Tooltip>
        </Flex>
      </Flex>

      <Text
        fontSize="sm"
        color={textColor}
        noOfLines={4}
        mb="12px"
        lineHeight="1.5"
        whiteSpace="pre-wrap"
      >
        {bookmark.text}
      </Text>

      <Flex justify="space-between" align="center">
        <HStack spacing="12px">
          <Flex align="center" gap="4px">
            <MdFavorite size={14} color="#e25555" />
            <Text fontSize="xs" color={subColor}>
              {formatNumber(bookmark.likes)}
            </Text>
          </Flex>
          <Flex align="center" gap="4px">
            <MdRepeat size={14} color="#00ba7c" />
            <Text fontSize="xs" color={subColor}>
              {formatNumber(bookmark.retweets)}
            </Text>
          </Flex>
          <Flex align="center" gap="4px">
            <MdVisibility size={14} color="#8899a6" />
            <Text fontSize="xs" color={subColor}>
              {formatNumber(bookmark.views)}
            </Text>
          </Flex>
        </HStack>

        {bookmark.tags && bookmark.tags.length > 0 && (
          <HStack spacing="4px">
            {bookmark.tags.slice(0, 3).map((tag) => (
              <Tag
                key={tag}
                size="sm"
                borderRadius="full"
                variant="subtle"
                colorScheme="brand"
                cursor="pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick && onTagClick(tag);
                }}
              >
                <TagLabel fontSize="xs">{tag}</TagLabel>
              </Tag>
            ))}
          </HStack>
        )}
      </Flex>
    </Card>
  );
}
