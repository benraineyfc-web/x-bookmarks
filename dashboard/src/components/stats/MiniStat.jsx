import {
  Flex,
  Stat,
  StatLabel,
  StatNumber,
  Icon,
  useColorModeValue,
} from "@chakra-ui/react";
import Card from "../card/Card";

export default function MiniStat({ name, value, icon, iconBg }) {
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const labelColor = useColorModeValue("secondaryGray.600", "secondaryGray.600");

  return (
    <Card>
      <Flex align="center" justify="space-between">
        <Stat>
          <StatLabel fontSize="xs" color={labelColor} fontWeight="500" mb="4px">
            {name}
          </StatLabel>
          <StatNumber fontSize="2xl" fontWeight="700" color={textColor}>
            {value}
          </StatNumber>
        </Stat>
        <Flex
          align="center"
          justify="center"
          borderRadius="50%"
          w="56px"
          h="56px"
          bg={iconBg || "brand.500"}
        >
          <Icon as={icon} w="28px" h="28px" color="white" />
        </Flex>
      </Flex>
    </Card>
  );
}
