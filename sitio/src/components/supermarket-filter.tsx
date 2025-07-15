import React from "react";
import { Button } from "src/components/ui/button";
import { SOURCES, SUPERMARKET_NAMES } from "src/lib/state";
import { useLocation } from "@tanstack/react-router";
import SupermarketLogo from "./supermarket-logo";

interface SupermarketFilterProps {
  selectedSupermarket: string | null;
  onSelect: (supermarket: string | null) => void;
}

const SupermarketFilter: React.FC<SupermarketFilterProps> = ({
  selectedSupermarket,
  onSelect,
}) => {
  const location = useLocation();

  const filteredSources = SOURCES;

  return (
    <div className="grid w-full grid-cols-3 gap-2">
      <div className="col-span-3 flex justify-center">
        <Button
          variant={!selectedSupermarket ? "default" : "outline"}
          size="sm"
          className="w-2/3 rounded-full"
          onClick={() => onSelect(null)}
        >
          Todos
        </Button>
      </div>
      {filteredSources.map((source) => (
        <Button
          key={source}
          variant={selectedSupermarket === source ? "default" : "outline"}
          size="sm"
          className="rounded-full gap-2 flex items-center justify-center"
          onClick={() => onSelect(source)}
        >
          <SupermarketLogo
            source={source}
            small={true}
            containerClassName="flex-shrink-0"
            className="h-4 max-w-[16px] md:h-5 md:max-w-[20px]"
          />
          <span className="truncate">{SUPERMARKET_NAMES[source]}</span>
        </Button>
      ))}
    </div>
  );
};

export default SupermarketFilter;
