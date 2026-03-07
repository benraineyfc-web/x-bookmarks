import { Box, Text, Flex, useColorModeValue } from "@chakra-ui/react";

/**
 * Simple SVG bar chart for bookmark trends.
 * data: [{ label: string, value: number }]
 */
export default function TrendChart({ data, title, color = "#7551FF" }) {
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const subColor = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const barBg = useColorModeValue("#E9E3FF", "rgba(117, 81, 255, 0.15)");

  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <Box>
      {title && (
        <Text fontSize="sm" fontWeight="700" color={textColor} mb="12px">
          {title}
        </Text>
      )}
      <Flex align="flex-end" gap="4px" h="100px">
        {data.map((d, i) => (
          <Flex
            key={i}
            direction="column"
            align="center"
            flex="1"
            minW="0"
          >
            <Box
              w="100%"
              maxW="32px"
              h={`${Math.max((d.value / max) * 80, 2)}px`}
              bg={color}
              borderRadius="4px 4px 0 0"
              transition="height 0.3s"
              title={`${d.label}: ${d.value}`}
            />
          </Flex>
        ))}
      </Flex>
      <Flex gap="4px" mt="4px">
        {data.map((d, i) => (
          <Text
            key={i}
            flex="1"
            fontSize="9px"
            color={subColor}
            textAlign="center"
            noOfLines={1}
          >
            {d.label}
          </Text>
        ))}
      </Flex>
    </Box>
  );
}
