default: 
	@echo "To continue, run \"make i-understand-that-this-is-unofficial-and-unsupported\""
i-understand-that-this-is-unofficial-and-unsupported: xpi
	@echo "\nRemember: this is an experiment. It is probably broken. Do not ask for support."
	@echo "In the future, you can just run \"make xpi\""
xpi: clean
	zip -r RES.xpi * 
clean:
	rm -f RES.xpi
