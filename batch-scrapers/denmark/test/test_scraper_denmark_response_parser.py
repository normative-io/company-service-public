from normative_batch_scrapers.scraper.denmark.response_parser import (
    parse_denmark_response,
)

_example_response_path = "test/data/example_initial_scroll_response.json"


def test_parse_single_item_response():
    with open(_example_response_path, mode="r") as f:
        resp = parse_denmark_response(f.read())
    print(resp)
